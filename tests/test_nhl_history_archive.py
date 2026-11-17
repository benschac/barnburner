import contextlib
import functools
import http.server
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/nhl-history-archive.py"
spec = importlib.util.spec_from_file_location("nhl_history_archive", SCRIPT)
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)

SEASONS = ["19171918", "20232024", "20242025", "20252026"]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def populate(root):
    for kind in ("seasons", "dressed"):
        (root / kind).mkdir(parents=True)
        for season in SEASONS:
            (root / kind / f"{season}-2.json.gz").write_bytes(f"{kind}{season}".encode())


def run(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = archive.main(argv)
    return code, out.getvalue(), err.getvalue()


class ArchiveTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.source = Path(self.tmp.name) / "source"
        self.target = Path(self.tmp.name) / "target"
        self.release = Path(self.tmp.name) / "release"
        self.release.mkdir()
        populate(self.source)
        run(["manifest", "--root", str(self.source)])
        self.manifest = json.loads((self.source / "manifest.json").read_text())
        for entry in self.manifest["files"]:
            (self.release / entry["asset"]).write_bytes((self.source / entry["path"]).read_bytes())
        handler = functools.partial(Quiet, directory=str(self.release))
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.url = f"http://127.0.0.1:{self.server.server_port}/"
        self.target.mkdir()
        (self.target / "manifest.json").write_text((self.source / "manifest.json").read_text())

    def fetch(self):
        return run(["fetch", "--root", str(self.target), "--base-url", self.url])

    def test_manifest_excludes_two_latest_seasons(self):
        self.assertEqual(self.manifest["release"], "nhl-history-archive")
        self.assertEqual([e["asset"] for e in self.manifest["files"]],
                         ["dressed-19171918-2.json.gz", "seasons-19171918-2.json.gz",
                          "dressed-20232024-2.json.gz", "seasons-20232024-2.json.gz"])
        entry = self.manifest["files"][1]
        self.assertEqual(entry["path"], "seasons/19171918-2.json.gz")
        self.assertEqual(entry["bytes"], len(b"seasons19171918"))
        self.assertEqual(len(entry["sha256"]), 64)

    def test_manifest_is_deterministic(self):
        before = (self.source / "manifest.json").read_text()
        run(["manifest", "--root", str(self.source)])
        self.assertEqual(before, (self.source / "manifest.json").read_text())

    def test_fetch_restores_files(self):
        code, _, _ = self.fetch()
        self.assertEqual(code, 0)
        for entry in self.manifest["files"]:
            self.assertEqual((self.target / entry["path"]).read_bytes(),
                             (self.source / entry["path"]).read_bytes())

    def test_good_file_is_skipped(self):
        self.fetch()
        for entry in self.manifest["files"]:
            (self.release / entry["asset"]).unlink()
        code, out, _ = self.fetch()
        self.assertEqual(code, 0)
        self.assertIn("fetched 0, skipped 4", out)

    def test_corrupt_download_fails_without_partial_file(self):
        entry = self.manifest["files"][0]
        (self.release / entry["asset"]).write_bytes(b"x" * entry["bytes"])
        code, _, err = self.fetch()
        self.assertEqual(code, 1)
        self.assertIn("sha256", err)
        self.assertEqual(list(self.target.rglob("*.json.gz*")), [])


if __name__ == "__main__":
    unittest.main()
