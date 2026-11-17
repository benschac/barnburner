from pathlib import Path
import runpy
import sqlite3
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))
from test_build_nhl_serving import DRESSED, make_base
from test_nhl_serving_graph import EXPECTED, le, read_blobs

build = runpy.run_path(str(ROOT / "scripts/build-nhl-serving.py"))["build"]

# Link order: 11-12, 11-13, 12-14, 13-14, 14-15, 15-16, 16-17 (partners), 17-18, 19-20.
WITH_PARTNERS = {
    "edge_a": le("H", [0, 0, 1, 2, 3, 4, 5, 6, 8]),
    "edge_b": le("H", [1, 2, 3, 3, 4, 5, 6, 7, 9]),
    "span_start": le("I", range(10)),
    "span_season": le("B", [0, 0, 1, 1, 1, 0, 1, 1, 0]),
    "span_kind": le("B", [2, 2, 2, 2, 3, 2, 2, 2, 2]),
    "span_team": le("B", [0, 0, 1, 1, 1, 2, 2, 2, 3]),
    "span_link": le("B", [0, 0, 0, 0, 0, 0, 1, 0, 0]),
    "span_games": le("H", [2, 1, 2, 1, 2, 2, 3, 1, 1]),
    "span_first_game": le("I", [1950020001, 1950020003, 1951020001, 1951020003, 1951030111,
                                1950020001, 1951020001, 1951020002, 1950020003]),
}


def add_game(path, game, credited, dressed):
    db = sqlite3.connect(path)
    db.execute("INSERT INTO game_sides VALUES(?,?,?,?,?,?,?,?,?,?)",
               (game, 3, 19511952, 2, "1951-12-01", "T3", "Team 3", "H", 2, "team-summary"))
    for player in credited:
        db.execute("INSERT INTO appearances VALUES(19511952,2,?,3,'T3',?,?,?,?,?)",
                   (game, player, f"Player {player}", "goalie", "G", 0))
    db.executemany("INSERT INTO dressed_goalies VALUES(?,?,?)", [(game, 3, p) for p in dressed])
    db.commit()
    db.close()


class PartnersTest(unittest.TestCase):
    def build(self, tmp, dressed=DRESSED, extra=()):
        base, out = Path(tmp) / "base.sqlite", Path(tmp) / "out.sqlite"
        make_base(base, dressed)
        for args in extra:
            add_game(base, *args)
        build(base, out)
        return out

    def test_mini_blobs_with_partner_span(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = self.build(tmp)
            blobs = read_blobs(out)
            db = sqlite3.connect(out)
            teammates = dict(db.execute("SELECT player_id, teammates FROM players"))
            dressed = db.execute("SELECT * FROM dressed_goalies").fetchall()
            tables = [n for (n,) in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            db.close()
        for name, expected in {**EXPECTED, **WITH_PARTNERS}.items():
            self.assertEqual(blobs[name], expected, name)
        self.assertEqual(len(blobs["edge_a"]) // 2, 9)
        self.assertEqual((teammates[16], teammates[17]), (2, 2))
        self.assertNotIn(21, teammates)
        self.assertNotIn("spans", tables)
        # Goalie 21 has no credited game, so his dressed row is not served.
        self.assertEqual(dressed, [(g, t, p) for g, t, p in DRESSED if p != 21])

    def test_no_dressed_rows_changes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            blobs = read_blobs(self.build(tmp, dressed=None))
        self.assertEqual(blobs, EXPECTED)

    def test_partners_who_also_share_a_relief_game_keep_both_spans(self):
        extra = [(1951020010, [16, 17], [16, 17]),   # both credited: shared-game span
                 (1951020011, [16], [16, 17])]       # 17 dressed only: partner span
        with tempfile.TemporaryDirectory() as tmp:
            db = sqlite3.connect(self.build(tmp, extra=extra))
            blobs = dict(db.execute("SELECT name, bytes FROM graph_arrays"))
            db.close()
        # Link 16-17 is edge 6: a link-0 span (1 game) and a link-1 span (4 games).
        start = int.from_bytes(blobs["span_start"][6 * 4:6 * 4 + 4], "little")
        end = int.from_bytes(blobs["span_start"][7 * 4:7 * 4 + 4], "little")
        self.assertEqual(end - start, 2)
        self.assertEqual(blobs["span_link"][start:end], bytes([0, 1]))
        self.assertEqual(blobs["span_games"][start * 2:end * 2], le("H", [1, 4]))
        self.assertEqual(blobs["span_first_game"][start * 4:end * 4],
                         le("I", [1951020010, 1951020001]))

    def test_builds_are_identical(self):
        with tempfile.TemporaryDirectory() as tmp:
            base, a, b = (Path(tmp) / n for n in ("base.sqlite", "a.sqlite", "b.sqlite"))
            make_base(base, DRESSED)
            build(base, a)
            build(base, b)
            self.assertEqual(a.read_bytes(), b.read_bytes())


if __name__ == "__main__":
    unittest.main()
