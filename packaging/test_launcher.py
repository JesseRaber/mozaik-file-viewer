import contextlib
import hashlib
import http.server
import importlib.util
import pathlib
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location("launcher", pathlib.Path(__file__).with_name("Launch-Viewer.py"))
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)

class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name).resolve()
        self.site = self.root / "site"
        self.site.mkdir()
        (self.site / "index.html").write_text("Synthetic viewer", encoding="utf-8")
        (self.root / "private.txt").write_text("Do not serve", encoding="utf-8")
        self.previous = launcher.ROOT, launcher.SITE
        launcher.ROOT, launcher.SITE = self.root, self.site
        self.addCleanup(self.restore)

    def restore(self):
        launcher.ROOT, launcher.SITE = self.previous

    def manifest(self):
        (self.root / "SHA256SUMS.txt").write_text("".join(hashlib.sha256(f.read_bytes()).hexdigest() + "  " + f.relative_to(self.root).as_posix() + "\n" for f in sorted(self.root.rglob("*")) if f.is_file() and f.name != "SHA256SUMS.txt"), encoding="utf-8")

    def test_exact_package_and_changed_missing_extra_files(self):
        self.manifest(); launcher.verify()
        (self.site / "index.html").write_text("Changed", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"): launcher.verify()
        self.manifest(); (self.site / "extra.txt").write_text("Extra", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "unexpected"): launcher.verify()
        (self.site / "extra.txt").unlink(); (self.site / "index.html").unlink()
        with self.assertRaisesRegex(ValueError, "Invalid"): launcher.verify()

    def test_manifest_rejects_traversal_and_duplicates(self):
        self.manifest()
        f = self.root / "SHA256SUMS.txt"
        text = f.read_text(encoding="utf-8")
        f.write_text(text + text, encoding="utf-8")
        with self.assertRaises(ValueError): launcher.verify()
        f.write_text("0" * 64 + "  ../outside.txt\n", encoding="utf-8")
        with self.assertRaises(ValueError): launcher.verify()

    def test_server_serves_only_site_no_listing_no_write(self):
        with http.server.ThreadingHTTPServer(("127.0.0.1", 0), launcher.Handler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
            base = "http://127.0.0.1:%s" % server.server_port
            try:
                self.assertEqual(urllib.request.urlopen(base + "/").read(), b"Synthetic viewer")
                for path in ["/private.txt", "/../private.txt", "/%2e%2e/private.txt", "/..%5cprivate.txt"]:
                    with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(base + path)
                    self.assertIn(e.exception.code, [403, 404])
                (self.site / "empty").mkdir()
                with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(base + "/empty/")
                self.assertEqual(e.exception.code, 403)
                with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(urllib.request.Request(base + "/index.html", data=b"write"))
                self.assertEqual(e.exception.code, 501)
                self.assertEqual((self.site / "index.html").read_text(encoding="utf-8"), "Synthetic viewer")
            finally: server.shutdown(); thread.join()

if __name__ == "__main__": unittest.main()

