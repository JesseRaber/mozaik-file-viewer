"""Local read-only launcher. Python 3.10+ (bundled in the Windows package); no pip/npm or external service."""
import argparse
import functools
import hashlib
import http.server
import json
import pathlib
import socket
import sys
import urllib.parse
import urllib.request
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent
SITE = ROOT / "site"


def verify():
    entries = (ROOT / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines()
    seen = set()
    for line in entries:
        digest, name = line.split("  ", 1)
        target = (ROOT / name).resolve()
        if name in seen or len(digest) != 64 or not target.is_relative_to(ROOT) or not target.is_file():
            raise ValueError("Invalid package manifest entry")
        seen.add(name)
        if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError("Package checksum mismatch: " + name)
    actual = {f.relative_to(ROOT).as_posix() for f in ROOT.rglob("*") if f.is_file() and f != ROOT / "SHA256SUMS.txt"}
    if actual != seen:
        raise ValueError("Package contains missing or unexpected files")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def send_head(self):
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if ".." in path.replace("\\", "/").split("/"):
            self.send_error(403, "Path not allowed")
            return None
        target = pathlib.Path(self.translate_path(self.path)).resolve()
        if not target.is_relative_to(SITE.resolve()):
            self.send_error(403, "Path not allowed")
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(403, "Directory listing disabled")
        return None

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # The standard server sets SO_REUSEADDR, which on Windows lets a second
    # Viewer bind the same port silently. Bind exclusively so a busy port fails.
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def running_viewer(port):
    """Return the version served by a Viewer already on this port, or None."""
    try:
        with urllib.request.urlopen("http://127.0.0.1:%s/version.json" % port, timeout=2) as response:
            identity = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError):
        return None
    return identity.get("version") if isinstance(identity, dict) and isinstance(identity.get("version"), str) else None


def main():
    parser = argparse.ArgumentParser(description="Start the read-only Viewer on this computer only")
    parser.add_argument("--port", type=int, default=4187)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--check", action="store_true", help="verify the package files and exit")
    args = parser.parse_args()
    verify()
    if args.check:
        print("Viewer package OK: " + str(ROOT), flush=True)
        return
    try:
        server = Server(("127.0.0.1", args.port), Handler)
    except OSError:
        version = running_viewer(args.port)
        if version is None:
            raise
        url = "http://127.0.0.1:%s/" % args.port
        print("A Viewer (version " + version + ") is already running at " + url, flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        return
    with server:
        url = "http://127.0.0.1:%s/" % server.server_port
        print("Viewer package: " + str(ROOT), flush=True)
        print("Viewer URL: " + url + " (close this window or press Ctrl+C to stop)", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print("Viewer could not start: " + str(error), file=sys.stderr)
        sys.exit(1)
