import hashlib
from pathlib import Path
import runpy
import sqlite3
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SCHEMA = runpy.run_path(str(ROOT / "scripts/build-nhl-history.py"))["SCHEMA"]
build = runpy.run_path(str(ROOT / "scripts/build-nhl-serving.py"))["build"]

# Plan C-mini credited appearances; 16 and 17 are goalies.
GAMES = [
    (1950020001, {1: [11, 12], 3: [15, 16]}), (1950020002, {1: [11, 12], 3: [15, 16]}),
    (1950020003, {1: [11, 13], 4: [19, 20]}), (1951020001, {2: [12, 14], 3: [16]}),
    (1951020002, {2: [12, 14], 3: [17, 18]}), (1951020003, {2: [13, 14], 3: [16]}),
    (1951030111, {2: [14, 15], 3: [16]}), (1951030112, {2: [14, 15], 3: [16]}),
]
NAMES = {11: "Jean Béliveau"}


def make_base(path):
    db = sqlite3.connect(path)
    db.executescript(SCHEMA)
    for season, kind, sha in [(19501951, 2, "bb"), (19511952, 2, "aa"), (19511952, 3, "cc")]:
        db.execute("INSERT INTO partitions VALUES(?,?,?,?,?)", (season, kind, sha, "2024-01-01", "x"))
    for n, (game, sides) in enumerate(GAMES):
        season = 19501951 if game < 1951000000 else 19511952
        kind = game // 10000 % 100
        teams = list(sides)
        for i, team in enumerate(teams):
            db.execute("INSERT INTO game_sides VALUES(?,?,?,?,?,?,?,?,?,?)",
                       (game, team, season, kind, f"1950-11-{n + 1:02d}", f"T{team}", f"Team {team}",
                        "HR"[i], teams[1 - i], "team-summary"))
            for player in sides[team]:
                goalie = player in (16, 17)
                position = "G" if goalie else ("D" if player == 14 and game % 2 else "C")
                db.execute("INSERT INTO appearances VALUES(?,?,?,?,?,?,?,?,?,?)",
                           (season, kind, game, team, f"T{team}", player,
                            NAMES.get(player, f"Player {player}"),
                            "goalie" if goalie else "skater", position,
                            None if player == 12 else player - 10))
    # A second role row for the same appearance must not duplicate it.
    db.execute("INSERT INTO appearances VALUES(19501951,2,1950020001,1,'T1',11,'Jean Béliveau','goalie','C',0)")
    db.commit()
    db.close()


class ServingTest(unittest.TestCase):
    def test_tables_and_determinism(self):
        with tempfile.TemporaryDirectory() as tmp:
            base, a, b = (Path(tmp) / n for n in ("base.sqlite", "a.sqlite", "b.sqlite"))
            make_base(base)
            build(base, a)
            build(base, b)
            self.assertEqual(a.read_bytes(), b.read_bytes())
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()),
                             ["a.sqlite", "b.sqlite", "base.sqlite"])
            db = sqlite3.connect(a)
            q = lambda sql: db.execute(sql).fetchall()
            meta = dict(q("SELECT key, value FROM meta"))
            self.assertEqual(meta["snapshot_id"], hashlib.sha256(b"aabbcc").hexdigest()[:12])
            self.assertEqual(meta["schema_version"], "1")
            self.assertEqual(meta["cup_final_first_season"], "19261927")
            self.assertEqual(meta["latest_game_date"], "1950-11-08")
            self.assertEqual(q("SELECT * FROM teams"),
                             [(1, "T1", "Team 1"), (2, "T2", "Team 2"), (3, "T3", "Team 3"), (4, "T4", "Team 4")])
            games = q("SELECT * FROM games")
            self.assertEqual(len(games), 8)
            self.assertEqual(games[0], (1950020001, 19501951, 2, "1950-11-01", None, 0))
            self.assertEqual(games[6], (1951030111, 19511952, 3, "1950-11-07", 1, 1))
            self.assertEqual(games[7][4], 1)
            self.assertEqual(q("SELECT COUNT(*) FROM appearances"), [(28,)])
            self.assertIn((12, 1951020001, 2), q("SELECT * FROM appearances"))
            self.assertEqual(q("SELECT * FROM stints WHERE player_id=14"),
                             [(14, 19511952, 2, 2, 3, 1951020001, 1951020003),
                              (14, 19511952, 3, 2, 2, 1951030111, 1951030112)])
            self.assertEqual(q("SELECT * FROM stints WHERE player_id=16 AND game_type=3"),
                             [(16, 19511952, 3, 3, 2, 1951030111, 1951030112)])
            self.assertEqual(q("SELECT 1 FROM players WHERE player_id=21"), [])
            players = {r[0]: r for r in q("SELECT * FROM players")}
            self.assertEqual(sorted(players), list(range(11, 21)))
            self.assertEqual(players[11], (11, "Jean Béliveau", "jean beliveau", "C", 19501951, 19501951, 3, 3, 0))
            self.assertEqual(players[12][7], 0)
            self.assertEqual(players[16][3], "G")
            self.assertEqual(players[16][6:8], (6, 36))
            # Player 14: D in odd game ids (3 of 5 games), C otherwise.
            self.assertEqual(players[14][3:7], ("D", 19511952, 19511952, 5))
            self.assertTrue(all(p[8] == 0 for p in players.values()))


if __name__ == "__main__":
    unittest.main()
