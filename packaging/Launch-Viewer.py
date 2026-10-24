"""Local read-only launcher. Python 3.10+; no pip/npm or external service."""
import argparse
import functools
import hashlib
import http.server
import pathlib
import sys
import urllib.parse
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
    actual = {f.relative_to(ROOT).as_posix() for f in ROOT.rglob("*") if f.is_file() and f.name != "SHA256SUMS.txt"}
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


def main():
    parser = argparse.ArgumentParser(description="Start the read-only Viewer on this computer only")
    parser.add_argument("--port", type=int, default=4187)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    verify()
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        url = "http://127.0.0.1:%s/" % server.server_port
        print("Viewer package: " + str(ROOT), flush=True)
        print("Viewer URL: " + url + " (Ctrl+C to stop)", flush=True)
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
