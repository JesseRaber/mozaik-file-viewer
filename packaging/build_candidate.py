"""Package a clean, already-built exact commit for Windows x64; output must be outside source.

The package bundles the official python.org embeddable runtime (downloaded at package
time and pinned by SHA-256 below, never committed) so the receiving PC needs no Python,
no administrator rights and no other install step.
"""
import argparse
import hashlib
import io
import json
import pathlib
import shutil
import struct
import subprocess
import urllib.request
import zipfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]

# Official Windows embeddable package (64-bit). Hash from the python.org release page;
# Sigstore bundle at RUNTIME_URL + ".sigstore" (identity thomas@python.org, issuer accounts.google.com).
RUNTIME_VERSION = "3.13.17"
RUNTIME_URL = "https://www.python.org/ftp/python/3.13.17/python-3.13.17-embed-amd64.zip"
RUNTIME_SHA256 = "9e35319bffedab8b36ad44d8f377cb4f1733bcec257a0b6d04d94f01486ddb38"

SETUP_FILES = [("packaging/windows/Start-Viewer.cmd", "Start-Viewer.cmd"), ("packaging/windows/Install.cmd", "Install.cmd"),
               ("packaging/windows/Uninstall.cmd", "Uninstall.cmd"), ("packaging/windows/Install.ps1", "setup/Install.ps1"),
               ("packaging/windows/Uninstall.ps1", "setup/Uninstall.ps1")]


def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()


def runtime_bytes(cached):
    data = cached.read_bytes() if cached else urllib.request.urlopen(RUNTIME_URL, timeout=120).read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != RUNTIME_SHA256:
        raise ValueError("Python runtime hash mismatch: " + digest)
    return data


def add_runtime(package, data):
    runtime = package / "runtime"
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for info in z.infolist():
            target = (runtime / info.filename).resolve()
            if not target.is_relative_to(runtime.resolve()):
                raise ValueError("Unsafe runtime archive entry: " + info.filename)
        z.extractall(runtime)
    for required in ["python.exe", "python313._pth", "python313.zip", "LICENSE.txt"]:
        if not (runtime / required).is_file():
            raise ValueError("Runtime is missing " + required)
    return runtime / "LICENSE.txt"


def png(size, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y * size * 4:(y + 1) * size * 4]) for y in range(size))
    chunk = lambda kind, body: struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def icon_bytes():
    """Render public/favicon.svg's cabinet (same rectangles) as a multi-size .ico."""
    rects = [(8, 6, 16, 4, (0xB8, 0xC0, 0xC8)), (6, 10, 14, 16, (0xE8, 0xE4, 0xDC)), (20, 10, 6, 16, (0x1C, 0x24, 0x2E)), (12, 12, 2, 12, (0x0C, 0x0D, 0x0F))]
    images = []
    for size in [16, 24, 32, 48, 256]:
        pixels = bytearray()
        for y in range(size):
            for x in range(size):
                gx, gy = (x + 0.5) * 32 / size, (y + 0.5) * 32 / size
                cx, cy = min(max(gx, 6), 26), min(max(gy, 6), 26)
                if (gx - cx) ** 2 + (gy - cy) ** 2 > 36:
                    pixels += b"\x00\x00\x00\x00"; continue
                color = (0x0C, 0x0D, 0x0F)
                for rx, ry, rw, rh, c in rects:
                    if rx <= gx < rx + rw and ry <= gy < ry + rh: color = c
                pixels += bytes(color) + b"\xff"
        images.append((size, png(size, pixels)))
    header = struct.pack("<HHH", 0, 1, len(images))
    offset, entries, body = 6 + 16 * len(images), b"", b""
    for size, data in images:
        entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset + len(body))
        body += data
    return header + entries + body


def crlf(source, target):
    text = source.read_text(encoding="utf-8")
    if not text.isascii():
        raise ValueError("Windows scripts must be ASCII: " + str(source))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(text.replace("\r\n", "\n").replace("\n", "\r\n").encode("ascii"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("--runtime-zip", type=pathlib.Path, help="previously downloaded " + RUNTIME_URL.rsplit("/", 1)[1] + " (hash still checked)")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.is_relative_to(ROOT) or output.exists():
        raise ValueError("Output must be a new directory outside source")
    if git("status", "--porcelain"):
        raise ValueError("Commit reviewed changes before packaging")
    identity = json.loads((ROOT / "dist/version.json").read_text(encoding="utf-8"))
    version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    if identity != {"version": version, "revision": git("rev-parse", "HEAD"), "dirty": False}:
        raise ValueError("Build identity does not match clean source")
    runtime = runtime_bytes(args.runtime_zip)
    output.mkdir(parents=True)
    package = output / ("mozaik-file-viewer-" + version + "-windows-x64")
    shutil.copytree(ROOT / "dist", package / "site")
    shutil.copyfile(ROOT / "packaging/Launch-Viewer.py", package / "Launch-Viewer.py")
    shutil.copyfile(ROOT / "packaging/README-LOCAL.md", package / "README.md")
    shutil.copyfile(ROOT / "LICENSE", package / "LICENSE")
    for source, target in SETUP_FILES:
        crlf(ROOT / source, package / target)
    (package / "setup/viewer.ico").write_bytes(icon_bytes())
    python_license = add_runtime(package, runtime)
    # License files are copied from the exact locked, installed runtime dependencies.
    notices = package / "THIRD-PARTY-NOTICES"
    notices.mkdir()
    shutil.copyfile(python_license, notices / ("python-" + RUNTIME_VERSION + "-LICENSE.txt"))
    for dep, name in [("three", "LICENSE"), ("jszip", "LICENSE.markdown"), ("pako", "LICENSE"), ("lie", "license.md"), ("immediate", "LICENSE.txt"), ("setimmediate", "LICENSE.txt"), ("readable-stream", "LICENSE"), ("core-util-is", "LICENSE"), ("inherits", "LICENSE"), ("isarray", "README.md"), ("process-nextick-args", "license.md"), ("safe-buffer", "LICENSE"), ("string_decoder", "LICENSE"), ("util-deprecate", "LICENSE")]:
        source = ROOT / "node_modules" / dep / name
        if not source.is_file():
            raise ValueError("Missing dependency notice: " + str(source))
        shutil.copyfile(source, notices / (dep + "-" + name))
    manifest = {f.relative_to(package).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(package.rglob("*")) if f.is_file()}
    (package / "SHA256SUMS.txt").write_text("".join(h + "  " + n + "\n" for n, h in manifest.items()), encoding="utf-8")
    archive = output / (package.name + ".zip")
    with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(package.rglob("*")):
            if not f.is_file(): continue
            item = zipfile.ZipInfo(package.name + "/" + f.relative_to(package).as_posix(), (2026, 1, 1, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(item, f.read_bytes())
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output / "SHA256SUMS.txt").write_text(digest + "  " + archive.name + "\n", encoding="utf-8")
    print(json.dumps({"identity": identity, "runtime": {"version": RUNTIME_VERSION, "url": RUNTIME_URL, "sha256": RUNTIME_SHA256}, "archive": str(archive), "sha256": digest, "files": len(manifest) + 1}))


if __name__ == "__main__": main()
