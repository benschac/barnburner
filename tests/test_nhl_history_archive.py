import contextlib
import functools
import gzip
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


def write_gz(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(json.dumps(payload).encode()))


def populate(root):
    (root).mkdir(parents=True, exist_ok=True)
    (root / "seasons.json").write_text(json.dumps({"total": len(SEASONS), "data": [{"id": int(s)} for s in SEASONS]}))
    for season in SEASONS:
        for game_type in (2, 3):
            write_gz(root / "seasons" / f"{season}-{game_type}.json.gz", {"teams": [{"gameId": 1}, {"gameId": 2}]})
            write_gz(root / "dressed" / f"{season}-{game_type}.json.gz", {"games": {"1": {"home": []}, "2": {}}})


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
                         [f"{k}-{s}-{t}.json.gz" for s in SEASONS[:2]
                          for k in ("dressed", "seasons") for t in (2, 3)])
        entry = self.manifest["files"][2]
        self.assertEqual(entry["path"], "seasons/19171918-2.json.gz")
        self.assertEqual(entry["bytes"], (self.source / entry["path"]).stat().st_size)
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
        self.assertIn("fetched 0, skipped 8", out)

    def test_corrupt_download_fails_without_partial_file(self):
        entry = self.manifest["files"][0]
        (self.release / entry["asset"]).write_bytes(b"x" * entry["bytes"])
        code, _, err = self.fetch()
        self.assertEqual(code, 1)
        self.assertIn("sha256", err)
        self.assertEqual(list(self.target.rglob("*.json.gz*")), [])

    def test_fetch_uses_unique_temp_files(self):
        self.fetch()
        self.assertEqual(list(self.target.rglob("*.part")), [])

    def test_fetch_rejects_bad_manifest_paths(self):
        for bad in ("../evil.json.gz", "seasons/../../evil.json.gz", "/etc/passwd",
                    "other/19171918-2.json.gz", "seasons/1917-2.json.gz",
                    "seasons/19171918-4.json.gz", "seasons/19171918-2.json.gz\n"):
            manifest = dict(self.manifest, files=[dict(self.manifest["files"][0], path=bad)])
            (self.target / "manifest.json").write_text(json.dumps(manifest))
            code, _, err = self.fetch()
            self.assertEqual(code, 1, bad)
            self.assertIn("manifest path", err)

    def test_fetch_rejects_symlink_escape(self):
        outside = Path(self.tmp.name) / "outside"
        outside.mkdir()
        (self.target / "seasons").symlink_to(outside)
        code, _, err = self.fetch()
        self.assertEqual(code, 1)
        self.assertIn("escapes", err)
        self.assertEqual(list(outside.iterdir()), [])


class ManifestTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        populate(self.root)

    def test_missing_catalog_fails(self):
        (self.root / "seasons.json").unlink()
        code, _, err = run(["manifest", "--root", str(self.root)])
        self.assertEqual(code, 1)
        self.assertIn("catalog is missing", err)
        self.assertFalse((self.root / "manifest.json").exists())

    def test_cutoff_comes_from_catalog_not_files(self):
        for kind in ("seasons", "dressed"):
            for game_type in (2, 3):
                (self.root / kind / f"20252026-{game_type}.json.gz").unlink()
                (self.root / kind / f"20242025-{game_type}.json.gz").unlink()
        code, _, _ = run(["manifest", "--root", str(self.root)])
        self.assertEqual(code, 0)
        paths = {e["path"] for e in json.loads((self.root / "manifest.json").read_text())["files"]}
        self.assertEqual(len(paths), 8)
        self.assertFalse(any("20242025" in p or "20252026" in p for p in paths))

    def test_missing_files_are_listed(self):
        (self.root / "seasons" / "20232024-3.json.gz").unlink()
        (self.root / "dressed" / "19171918-2.json.gz").unlink()
        code, out, err = run(["manifest", "--root", str(self.root), "--files"])
        self.assertEqual(code, 1)
        self.assertIn("seasons/20232024-3.json.gz", err)
        self.assertIn("dressed/19171918-2.json.gz", err)
        self.assertEqual(out, "")
        self.assertFalse((self.root / "manifest.json").exists())

    def test_null_dressed_games_are_listed(self):
        write_gz(self.root / "dressed" / "20232024-2.json.gz", {"games": {"7": None, "8": {}}})
        code, out, err = run(["manifest", "--root", str(self.root), "--files"])
        self.assertEqual(code, 1)
        self.assertIn("dressed/20232024-2.json.gz: 7", err)
        self.assertNotIn(": 8", err)
        self.assertEqual(out, "")
        self.assertFalse((self.root / "manifest.json").exists())


    def test_missing_dressed_games_are_listed(self):
        write_gz(self.root / "dressed" / "20232024-2.json.gz", {"games": {"1": {}}})
        code, _, err = run(["manifest", "--root", str(self.root)])
        self.assertEqual(code, 1)
        self.assertIn("dressed/20232024-2.json.gz: 2", err)
        self.assertNotIn(": 1", err)

    def test_bad_catalog_is_rejected(self):
        rows = [{"id": int(s)} for s in SEASONS]
        for catalog in ({"total": 5, "data": rows}, {"total": 4, "data": rows[:3] + rows[:1]},
                        {"total": 4, "data": rows[:3] + [{"id": "20252026"}]}):
            (self.root / "seasons.json").write_text(json.dumps(catalog))
            code, _, err = run(["manifest", "--root", str(self.root)])
            self.assertEqual(code, 1)
            self.assertIn("catalog is unreadable", err)


if __name__ == "__main__":
    unittest.main()
