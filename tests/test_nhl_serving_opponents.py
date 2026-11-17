from pathlib import Path
import runpy
import sqlite3
import struct
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))
import nhl_serving_opponents  # noqa: E402
from test_build_nhl_serving import make_base  # noqa: E402

build = runpy.run_path(str(ROOT / "scripts/build-nhl-serving.py"))["build"]

# Plan C-mini opponent pairs as (player a, player b, games); indexes are id - 11.
PAIRS = [(11, 15, 2), (11, 16, 2), (11, 19, 1), (11, 20, 1), (12, 15, 2), (12, 16, 3),
         (12, 17, 1), (12, 18, 1), (13, 16, 1), (13, 19, 1), (13, 20, 1), (14, 16, 4),
         (14, 17, 1), (14, 18, 1), (15, 16, 2)]
OPP_A = (b"\x00\x00\x00\x00\x00\x00\x00\x00\x01\x00\x01\x00\x01\x00\x01\x00\x02\x00\x02\x00\x02\x00"
         b"\x03\x00\x03\x00\x03\x00\x04\x00")
OPP_B = (b"\x04\x00\x05\x00\x08\x00\x09\x00\x04\x00\x05\x00\x06\x00\x07\x00\x05\x00\x08\x00\x09\x00"
         b"\x05\x00\x06\x00\x07\x00\x05\x00")
OPP_GAMES = (b"\x02\x00\x02\x00\x01\x00\x01\x00\x02\x00\x03\x00\x01\x00\x01\x00\x01\x00\x01\x00\x01\x00"
             b"\x04\x00\x01\x00\x01\x00\x02\x00")


class OpponentsTest(unittest.TestCase):
    def build(self, tmp):
        base, out = Path(tmp) / "base.sqlite", Path(tmp) / "out.sqlite"
        make_base(base)
        build(base, out)
        return out

    def test_mini_blobs(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = sqlite3.connect(self.build(tmp))
            blobs = dict(db.execute("SELECT name, bytes FROM graph_arrays"))
            self.assertEqual(blobs["opp_a"], OPP_A)
            self.assertEqual(blobs["opp_b"], OPP_B)
            self.assertEqual(blobs["opp_games"], OPP_GAMES)
            # Cross-check the literals against the plan's pair list.
            self.assertEqual(struct.unpack("<15H", blobs["opp_a"]), tuple(a - 11 for a, _, _ in PAIRS))
            self.assertEqual(struct.unpack("<15H", blobs["opp_b"]), tuple(b - 11 for _, b, _ in PAIRS))
            self.assertEqual(struct.unpack("<15H", blobs["opp_games"]), tuple(n for _, _, n in PAIRS))
            self.assertEqual(db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='opp_game_team'").fetchone(), (0,))

    def test_count_over_limit_fails(self):
        old = nhl_serving_opponents.LIMIT
        nhl_serving_opponents.LIMIT = 3
        try:
            with tempfile.TemporaryDirectory() as tmp:
                with self.assertRaises(ValueError):
                    self.build(tmp)
        finally:
            nhl_serving_opponents.LIMIT = old


if __name__ == "__main__":
    unittest.main()
