import runpy
import sqlite3
import unittest
from pathlib import Path


checker = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/check_nhl_history.py"))


class HistoryCheck(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.executescript("""
            CREATE TABLE partitions(season_id, game_type);
            INSERT INTO partitions VALUES(19171918,2), (19171918,3);
            CREATE TABLE appearances(season_id,game_type,game_id,team_id,player_id,role);
            INSERT INTO appearances VALUES
              (19171918,2,1,10,51,'skater'), (19171918,2,2,20,51,'skater'),
              (19171918,3,3,20,52,'goalie');
        """)
        self.snapshot = dict(fetchedAt="test", seasons=[19171918], reports=[
            [19171918, 2, "skater", [[51, 2]]], [19171918, 2, "goalie", []],
            [19171918, 3, "skater", []], [19171918, 3, "goalie", [[52, 1]]]])

    def test_traded_and_playoff_only_players(self):
        result = checker["check"](self.db, self.snapshot)
        self.assertEqual(result["differences"], [])
        self.assertEqual(result["importedAppearances"], 3)

    def test_missing_extra_duplicate_and_missing_partition(self):
        self.db.execute("UPDATE appearances SET player_id=53 WHERE game_id=1")
        self.db.execute("INSERT INTO appearances SELECT * FROM appearances WHERE game_id=3")
        self.db.execute("DELETE FROM partitions WHERE game_type=2")
        result = checker["check"](self.db, self.snapshot)
        self.assertEqual({row["playerId"] for row in result["differences"]}, {51, 52, 53})
        self.assertEqual(result["duplicates"], [(3, 20, 52, "goalie", 2)])
        self.assertEqual(result["missingPartitions"], [(19171918, 2)])

    def test_dual_role_credits_for_one_appearance(self):
        self.db.execute("INSERT INTO appearances VALUES(19171918,3,3,20,52,'skater')")
        self.snapshot["reports"][2][3].append([52, 1])
        result = checker["check"](self.db, self.snapshot)
        self.assertEqual(result["differences"], [])
        self.assertEqual(result["duplicates"], [])
        self.assertEqual(result["dualRoleAppearances"], 1)

    def test_skipped_historical_season(self):
        with self.assertRaises(ValueError):
            checker["verify_seasons"]([19171918, 19191920])
