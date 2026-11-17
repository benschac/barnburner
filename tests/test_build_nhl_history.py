import gzip
import json
from pathlib import Path
import runpy
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
build = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/build-nhl-history.py"))["build"]


class HistoryTest(unittest.TestCase):
    def test_trade_appearances_and_rollback(self):
        with tempfile.TemporaryDirectory() as tmp, sqlite3.connect(":memory:") as db:
            root = Path(tmp)
            totals = dict(fetchedAt="2024-01-01", seasons=[19171918],
                          reports=[[19171918, k, r, [[1,1],[2,1],[3,2]] if (k,r)==(2,"skater") else [[4,1]] if (k,r)==(2,"goalie") else []]
                                   for k in (2,3) for r in ("skater","goalie")])
            (root / "season-totals.json.gz").write_bytes(gzip.compress(json.dumps(totals).encode()))
            directory = root / "seasons"
            directory.mkdir()
            season = 19171918
            (root / "seasons.json").write_text(json.dumps({"data": [{"id": season}], "total": 1}))
            data = dict(seasonId=season, gameType=2, fetchedAt="2024-01-01", sources=["https://api.nhle.com"],
                        teams=[], skaters=[], goalies=[])

            def save():
                path = directory / f'{season}-{data["gameType"]}.json.gz'
                path.write_bytes(gzip.compress(json.dumps(data).encode()))

            for n, traded_side in [(1, "H"), (2, "R")]:
                for side, team, opponent in [("H", "AAA", "BBB"), ("R", "BBB", "AAA")]:
                    base = dict(gameId=1917020000 + n, gameDate=f"2023-12-0{n}", homeRoad=side,
                                opponentTeamAbbrev=opponent, gamesPlayed=1)
                    data["teams"].append(dict(base, teamId=1 if side == "H" else 2, teamFullName=team))
                    players = [1 if n == 1 else 2] if side == traded_side else []
                    for player in players + ([3] if side == traded_side else []):
                        data["skaters"].append(dict(base, teamAbbrev=team, playerId=player,
                                                    skaterFullName=f"Player {player}",
                                                    positionCode="D" if player == 3 else "C",
                                                    points=None if player == 3 else player))
                    data["goalies"].append(dict(base, gamesPlayed=int(n == 1 and side == "H"),
                                                teamAbbrev=team, playerId=4,
                                                goalieFullName="Backup"))
            # Historical source reports sometimes invert home/road or disagree on a date.
            data["skaters"][0].update(homeRoad="R", gameDate="2023-12-03")
            save()
            regular = data
            data = dict(data, gameType=3, skaters=[], goalies=[], teams=[])
            save()
            self.assertEqual(build(root, db), 2)
            self.assertEqual(build(root, db), 0)
            evidence = db.execute("SELECT player_id,reported_side,reported_date FROM source_disagreements")
            self.assertEqual(list(evidence), [(1, "R", "2023-12-03")])
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 2)
            rows = db.execute("SELECT player_id,position,points FROM appearances ORDER BY game_id,player_id")
            self.assertEqual(list(rows), [(1, "C", 1), (3, "D", None), (4, "G", None), (2, "C", 2), (3, "D", None)])
            pairs = db.execute("""SELECT a.player_id,b.player_id FROM appearances a JOIN appearances b
                                  USING(game_id,team_id) WHERE a.player_id<b.player_id ORDER BY 1,2""")
            self.assertEqual(list(pairs), [(1, 3), (1, 4), (2, 3), (3, 4)])
            data = regular
            missing = data["skaters"].pop()
            save()
            with self.assertRaisesRegex(ValueError, "season reconciliation failed"):
                build(root, db, refetch=lambda *_: None)
            data["skaters"].append(missing)
            data["skaters"][0]["teamAbbrev"] = "BBB"
            save()
            with self.assertRaisesRegex(ValueError, "side mismatch"):
                build(root, db)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM appearances").fetchone()[0], 5)

    def test_retry_refetches_recent_seasons_once(self):
        seasons = [19171918, 19181919, 19191920]

        def setup(root, wrong_season):
            (root / "seasons").mkdir()
            (root / "seasons.json").write_text(json.dumps({"data": [{"id": s} for s in seasons], "total": 3}))
            for s in seasons:
                for k in (2, 3):
                    data = dict(seasonId=s, gameType=k, fetchedAt="t", sources=["u"], teams=[], skaters=[], goalies=[])
                    (root / "seasons" / f"{s}-{k}.json.gz").write_bytes(gzip.compress(json.dumps(data).encode()))
            write_totals(root, wrong_season)

        def write_totals(root, wrong_season):
            reports = [[s, k, r, [[9, 1]] if s == wrong_season and (k, r) == (2, "skater") else []]
                       for s in seasons for k in (2, 3) for r in ("skater", "goalie")]
            totals = dict(fetchedAt="t", seasons=seasons, reports=reports)
            (root / "season-totals.json.gz").write_bytes(gzip.compress(json.dumps(totals).encode()))

        for wrong, expected_calls in [(19191920, [[19181919, 19191920]]), (19171918, [])]:
            with tempfile.TemporaryDirectory() as tmp, sqlite3.connect(":memory:") as db:
                root, calls = Path(tmp), []
                setup(root, wrong)

                def refetch(path, recent):
                    calls.append(list(recent))
                    write_totals(path, None)

                if expected_calls:
                    build(root, db, refetch=refetch)
                else:
                    with self.assertRaisesRegex(ValueError, "season reconciliation failed"):
                        build(root, db, refetch=refetch)
                self.assertEqual(calls, expected_calls)

    def test_refetch_recent_archives_and_totals(self):
        module = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/build-nhl-history.py"))
        archived, totalled = [], []
        module["refetch_recent"](Path("/x"), [2, 3], archive=lambda s, k: archived.append((s, k)) or "ok",
                                 totals=lambda path, seasons: totalled.append((path.name, seasons)))
        self.assertEqual(archived, [(2, 2), (2, 3), (3, 2), (3, 3)])
        self.assertEqual(totalled, [("season-totals.json.gz", [2, 3])])

    def test_goalie_position_and_old_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "seasons.json").write_text(json.dumps({"data": [{"id": 19171918}], "total": 1}))
            old = sqlite3.connect(":memory:")
            old.execute("CREATE TABLE appearances(x)")
            with self.assertRaisesRegex(ValueError, "delete the file and rebuild"):
                build(root, old)
            old.execute("PRAGMA user_version = 1")
            with self.assertRaisesRegex(ValueError, "delete the file and rebuild"):
                build(root, old)


if __name__ == "__main__":
    unittest.main()
