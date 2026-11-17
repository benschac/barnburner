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
                          reports=[[19171918, k, r, [[1,1],[2,1],[3,2]] if (k,r)==(2,"skater") else []]
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
                                                    skaterFullName=f"Player {player}"))
                    data["goalies"].append(dict(base, gamesPlayed=0, teamAbbrev=team, playerId=4,
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
            pairs = db.execute("""SELECT a.player_id,b.player_id FROM appearances a JOIN appearances b
                                  USING(game_id,team_id) WHERE a.player_id<b.player_id ORDER BY 1,2""")
            self.assertEqual(list(pairs), [(1, 3), (2, 3)])
            data = regular
            missing = data["skaters"].pop()
            save()
            with self.assertRaisesRegex(ValueError, "season reconciliation failed"):
                build(root, db)
            data["skaters"].append(missing)
            data["skaters"][0]["teamAbbrev"] = "BBB"
            save()
            with self.assertRaisesRegex(ValueError, "side mismatch"):
                build(root, db)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM appearances").fetchone()[0], 4)


if __name__ == "__main__":
    unittest.main()
