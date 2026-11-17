import contextlib
import gzip
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/import-nhl-dressed.py"
spec = importlib.util.spec_from_file_location("import_nhl_dressed", SCRIPT)
dressed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dressed)


class Killed(BaseException):
    pass


def box(game_id):
    return {
        "awayTeam": {"abbrev": "AAA"}, "homeTeam": {"abbrev": "HHH"},
        "playerByGameStats": {
            "awayTeam": {"goalies": [{"playerId": game_id, "toi": "60:00"}]},
            "homeTeam": {"goalies": [{"playerId": game_id + 1, "toi": None}]},
        },
    }


class DressedTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "seasons").mkdir()
        self.ids = [2023020001 + i for i in range(5)]
        snapshot = {"seasonId": 20232024, "gameType": 2,
                    "teams": [{"gameId": g, "teamId": t} for g in self.ids for t in (1, 2)]}
        with gzip.open(self.root / "seasons/20232024-2.json.gz", "wt") as file:
            json.dump(snapshot, file)
        self.calls = []
        self.lock = threading.Lock()

    def tearDown(self):
        self.temp.cleanup()

    def run_cli(self, fetch, *extra):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            dressed.main(["--root", str(self.root), *extra], fetch=fetch, sleep=lambda s: None, batch=2)
        return out.getvalue()

    def stored(self):
        with gzip.open(self.root / "dressed/20232024-2.json.gz", "rt") as file:
            return json.load(file)

    def gid(self, url):
        return int(url.split("/gamecenter/")[1].split("/")[0])

    def test_output_shape(self):
        def fetch(url):
            self.calls.append(url)
            return box(self.gid(url))
        report = self.run_cli(fetch)
        data = self.stored()
        self.assertEqual((data["seasonId"], data["gameType"]), (20232024, 2))
        self.assertEqual(data["games"]["2023020001"], {
            "AAA": [{"playerId": 2023020001, "toi": "60:00"}],
            "HHH": [{"playerId": 2023020002, "toi": None}]})
        self.assertIn("fetched 5, skipped 0, null 0", report)
        self.assertTrue(all(c.endswith("/boxscore") for c in self.calls))

    def test_missing_goalies_is_empty_list_not_null(self):
        data = self.run_cli(lambda url: {"awayTeam": {"abbrev": "A"}, "homeTeam": {"abbrev": "H"}})
        self.assertEqual(self.stored()["games"]["2023020001"], {"A": [], "H": []})
        self.assertIn("null 0", data)

    def test_killed_run_resumes_without_refetching(self):
        def dying(url):
            with self.lock:
                self.calls.append(self.gid(url))
                if len(self.calls) > 3:
                    raise Killed()
            return box(self.gid(url))
        with self.assertRaises(Killed):
            self.run_cli(dying)
        saved = {g for g, v in self.stored()["games"].items() if v is not None}
        self.assertEqual(len(saved), 2)  # one full batch of two was written
        self.calls.clear()
        report = self.run_cli(lambda url: self.calls.append(self.gid(url)) or box(self.gid(url)))
        self.assertTrue(saved.isdisjoint(str(c) for c in self.calls))
        self.assertEqual(len(self.stored()["games"]), 5)
        self.assertIn("fetched 3, skipped 2, null 0", report)

    def test_null_game_is_retried_and_refresh_refetches(self):
        bad = self.ids[1]

        def flaky(url):
            if self.gid(url) == bad:
                raise OSError("down")
            return box(self.gid(url))
        report = self.run_cli(flaky)
        self.assertIsNone(self.stored()["games"][str(bad)])
        self.assertIn("null 1", report)
        self.calls.clear()
        report = self.run_cli(lambda url: self.calls.append(self.gid(url)) or box(self.gid(url)))
        self.assertEqual(self.calls, [bad])
        self.assertIn("fetched 1, skipped 4, null 0", report)
        self.calls.clear()
        self.run_cli(lambda url: self.calls.append(self.gid(url)) or box(self.gid(url)), "--refresh")
        self.assertEqual(len(self.calls), 5)

    def test_rate_limit_is_never_stored(self):
        state = {"n": 0}

        def limited(url):
            if self.gid(url) == self.ids[0] and state["n"] < 2:
                state["n"] += 1
                raise dressed.RateLimited(url)
            return box(self.gid(url))
        self.run_cli(limited)
        self.assertEqual(self.stored()["games"]["2023020001"]["AAA"][0]["playerId"], 2023020001)

        def always(url):
            raise dressed.RateLimited(url)
        self.run_cli(always, "--refresh")
        self.assertTrue(all(v is not None for v in self.stored()["games"].values()))

    def test_season_filter(self):
        self.run_cli(lambda url: box(self.gid(url)), "--season", "19992000")
        self.assertEqual(list((self.root / "dressed").iterdir()), [])


if __name__ == "__main__":
    unittest.main()
