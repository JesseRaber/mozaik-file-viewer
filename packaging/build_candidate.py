"""Package a clean, already-built exact commit; output must be outside source."""
import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]

def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=pathlib.Path)
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
    output.mkdir(parents=True)
    package = output / ("mozaik-file-viewer-" + version + "-local")
    shutil.copytree(ROOT / "dist", package / "site")
    shutil.copyfile(ROOT / "packaging/Launch-Viewer.py", package / "Launch-Viewer.py")
    shutil.copyfile(ROOT / "packaging/README-LOCAL.md", package / "README.md")
    shutil.copyfile(ROOT / "LICENSE", package / "LICENSE")
    # License files are copied from the exact locked, installed runtime dependencies.
    notices = package / "THIRD-PARTY-NOTICES"
    notices.mkdir()
    for dep, name in [("three", "LICENSE"), ("jszip", "LICENSE.markdown"), ("pako", "LICENSE"), ("lie", "license.md"), ("immediate", "LICENSE.txt"), ("setimmediate", "LICENSE.txt"), ("readable-stream", "LICENSE"), ("core-util-is", "LICENSE"), ("inherits", "LICENSE"), ("isarray", "README.md"), ("process-nextick-args", "license.md"), ("safe-buffer", "LICENSE"), ("string_decoder", "LICENSE"), ("util-deprecate", "LICENSE")]:
        source = ROOT / "node_modules" / dep / name
        if not source.is_file():
            raise ValueError("Missing dependency notice: " + str(source))
        shutil.copyfile(source, notices / (dep + "-" + name))
    manifest = {f.relative_to(package).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(package.rglob("*")) if f.is_file()}
    (package / "SHA256SUMS.txt").write_text("".join(h + "  " + n + "\n" for n,h in manifest.items()), encoding="utf-8")
    archive = output / (package.name + ".zip")
    with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(package.rglob("*")):
            if not f.is_file(): continue
            item = zipfile.ZipInfo(package.name + "/" + f.relative_to(package).as_posix(), (2026,1,1,0,0,0))
            item.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(item, f.read_bytes())
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output / "SHA256SUMS.txt").write_text(digest + "  " + archive.name + "\n", encoding="utf-8")
    print(json.dumps({"identity":identity,"archive":str(archive),"sha256":digest,"files":len(manifest)+1}))

if __name__ == "__main__": main()
