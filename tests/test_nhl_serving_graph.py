from array import array
from pathlib import Path
import runpy
import sqlite3
import sys
import tempfile
import types
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))
import nhl_serving_graph_pack as graph_pack
from test_build_nhl_serving import make_base

NAMESPACE = runpy.run_path(str(ROOT / "scripts/build-nhl-serving.py"))
build = NAMESPACE["build"]


def le(code, values):
    """Little-endian bytes written without array, so the test is independent of pack()."""
    width = {"B": 1, "H": 2, "I": 4}[code]
    return b"".join(v.to_bytes(width, "little") for v in values)


# Plan C-mini shared-game links only. Players 11-20 are indexes 0-9, seasons
# 1950-51 and 1951-52 are 0 and 1, teams 1-4 are 0-3.
# Links in (a, b) order: 11-12, 11-13, 12-14, 13-14, 14-15, 15-16, 17-18, 19-20.
EXPECTED = {
    "player_ids": le("I", range(11, 21)),
    "season_ids": le("I", [19501951, 19511952]),
    "team_ids": le("I", [1, 2, 3, 4]),
    "edge_a": le("H", [0, 0, 1, 2, 3, 4, 6, 8]),
    "edge_b": le("H", [1, 2, 3, 3, 4, 5, 7, 9]),
    "span_start": le("I", [0, 1, 2, 3, 4, 5, 6, 7, 8]),
    "span_season": le("B", [0, 0, 1, 1, 1, 0, 1, 0]),
    "span_kind": le("B", [2, 2, 2, 2, 3, 2, 2, 2]),
    "span_team": le("B", [0, 0, 1, 1, 1, 2, 2, 3]),
    "span_link": le("B", [0] * 8),
    "span_games": le("H", [2, 1, 2, 1, 2, 2, 1, 1]),
    "span_first_game": le("I", [1950020001, 1950020003, 1951020001, 1951020003,
                                1951030111, 1950020001, 1951020002, 1950020003]),
}


def read_blobs(path):
    db = sqlite3.connect(path)
    try:
        return dict(db.execute("SELECT name, bytes FROM graph_arrays WHERE name NOT GLOB 'opp_*'"))
    finally:
        db.close()


class GraphArraysTest(unittest.TestCase):
    def build(self, tmp, steps=None):
        base, out = Path(tmp) / "base.sqlite", Path(tmp) / "out.sqlite"
        make_base(base)
        if steps is None:
            build(base, out)
        else:
            with mock.patch.dict(build.__globals__, {"STEPS": steps}):
                build(base, out)
        return out

    def test_blobs_equal_contract_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            blobs = read_blobs(self.build(tmp))
        self.assertEqual(sorted(blobs), sorted(EXPECTED))
        for name, expected in EXPECTED.items():
            self.assertEqual(blobs[name], expected, name)

    def test_teammates_and_scratch_table(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = sqlite3.connect(self.build(tmp))
            teammates = dict(db.execute("SELECT player_id, teammates FROM players"))
            self.assertEqual(teammates, {11: 2, 12: 2, 13: 2, 14: 3, 15: 2,
                                         16: 1, 17: 1, 18: 1, 19: 1, 20: 1})
            tables = [n for (n,) in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            self.assertNotIn("spans", tables)
            self.assertIn("graph_arrays", tables)
            db.close()

    def test_partner_rows_inserted_between_the_steps(self):
        partner = types.ModuleType("fake_partner_step")
        # 16-17 as goalie partners, plus a second (partner) span for 17-18.
        partner.run = lambda base, out: out.executemany(
            "INSERT INTO spans VALUES(?,?,?,?,?,?,?,?)",
            [(16, 17, 19511952, 2, 3, 1, 3, 1951020001),
             (17, 18, 19511952, 2, 3, 1, 1, 1951020001)])
        sys.modules["fake_partner_step"] = partner
        self.addCleanup(sys.modules.pop, "fake_partner_step")
        steps = ["nhl_serving_tables", "nhl_serving_graph", "fake_partner_step",
                 "nhl_serving_graph_pack"]
        with tempfile.TemporaryDirectory() as tmp:
            out = self.build(tmp, steps)
            blobs = read_blobs(out)
            db = sqlite3.connect(out)
            teammates = dict(db.execute("SELECT player_id, teammates FROM players"))
            db.close()
        # 16-17 is a new link (5,6); 17-18 (6,7) now holds a link-0 span then a link-1 span.
        self.assertEqual(blobs["edge_a"], le("H", [0, 0, 1, 2, 3, 4, 5, 6, 8]))
        self.assertEqual(blobs["edge_b"], le("H", [1, 2, 3, 3, 4, 5, 6, 7, 9]))
        self.assertEqual(blobs["span_start"], le("I", [0, 1, 2, 3, 4, 5, 6, 7, 9, 10]))
        self.assertEqual(blobs["span_link"], le("B", [0, 0, 0, 0, 0, 0, 1, 0, 1, 0]))
        self.assertEqual(blobs["span_games"], le("H", [2, 1, 2, 1, 2, 2, 3, 1, 1, 1]))
        self.assertEqual((teammates[16], teammates[17], teammates[18]), (2, 2, 1))

    def test_size_limits_fail(self):
        for limit, value in [("MAX_PLAYERS", 9), ("MAX_TEAMS", 3), ("MAX_SEASONS", 1),
                             ("MAX_GAMES", 1)]:
            with self.subTest(limit=limit), tempfile.TemporaryDirectory() as tmp:
                with mock.patch.object(graph_pack, limit, value):
                    with self.assertRaises(ValueError):
                        self.build(tmp)
                self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), ["base.sqlite"])

    def test_limits_at_the_edge_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(graph_pack, "MAX_PLAYERS", 10), \
                    mock.patch.object(graph_pack, "MAX_TEAMS", 4), \
                    mock.patch.object(graph_pack, "MAX_SEASONS", 2), \
                    mock.patch.object(graph_pack, "MAX_GAMES", 2):
                self.assertEqual(read_blobs(self.build(tmp)), EXPECTED)

    def test_big_endian_host_byteswaps(self):
        self.assertEqual(graph_pack.pack(graph_pack.U32, [1, 0x01020304]), le("I", [1, 0x01020304]))
        with mock.patch.object(sys, "byteorder", "big"):
            swapped = graph_pack.pack(graph_pack.U32, [1, 0x01020304])
        # This host is little-endian, so the explicit swap must invert the bytes.
        expected = array(graph_pack.U32, [1, 0x01020304])
        expected.byteswap()
        self.assertEqual(swapped, expected.tobytes())


if __name__ == "__main__":
    unittest.main()
