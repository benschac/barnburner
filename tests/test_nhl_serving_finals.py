from pathlib import Path
import sqlite3
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import nhl_serving_finals  # noqa: E402

GAMES_SQL = """CREATE TABLE games (
    game_id INTEGER PRIMARY KEY, season_id INTEGER NOT NULL, game_type INTEGER NOT NULL,
    game_date TEXT NOT NULL, playoff_round INTEGER, cup_final INTEGER NOT NULL)"""
SIDES_SQL = "CREATE TABLE game_sides (game_id INTEGER, team_id INTEGER)"


def make_inputs(games, sides):
    """games: (game_id, season_id, game_type, playoff_round); sides: (game_id, team_id)."""
    out = sqlite3.connect(":memory:")
    out.execute(GAMES_SQL)
    out.executemany("INSERT INTO games VALUES(?,?,?,'1950-01-01',?,0)",
                    [(g, s, t, r) for g, s, t, r in games])
    base = sqlite3.connect(":memory:")
    base.execute(SIDES_SQL)
    base.executemany("INSERT INTO game_sides VALUES(?,?)", sides)
    return base, out


def two_teams(*games):
    return [(g, t) for g in games for t in (1, 2)]


class FinalsTest(unittest.TestCase):
    def flagged(self, out):
        return [r[0] for r in out.execute("SELECT game_id FROM games WHERE cup_final = 1 ORDER BY game_id")]

    def test_highest_round_per_season(self):
        games = [
            (1951030111, 19511952, 3, 1), (1951030121, 19511952, 3, 1),
            (1951030211, 19511952, 3, 2), (1951030411, 19511952, 3, 4),
            (1951030412, 19511952, 3, 4), (1951020001, 19511952, 2, None),
            (1961030111, 19611962, 3, 1), (1961030211, 19611962, 3, 2),
            (1961030311, 19611962, 3, 3), (1961030411, 19611962, 3, 4),
        ]
        sides = two_teams(*[g for g, *_ in games if g != 1951020001])
        base, out = make_inputs(games, sides)
        nhl_serving_finals.run(base, out)
        self.assertEqual(self.flagged(out), [1951030411, 1951030412, 1961030411])

    def test_suspended_game_override(self):
        games = [
            (1987030811, 19871988, 3, 8), (1987030812, 19871988, 3, 8),
            (1987030999, 19871988, 3, 9), (1987030111, 19871988, 3, 1),
        ]
        sides = two_teams(1987030811, 1987030812, 1987030999, 1987030111)
        base, out = make_inputs(games, sides)
        nhl_serving_finals.run(base, out)
        self.assertEqual(self.flagged(out), [1987030811, 1987030812, 1987030999])

    def test_suspended_game_ignored_without_its_season(self):
        games = [(1987030999, 19861987, 3, 9), (1986030411, 19861987, 3, 4)]
        base, out = make_inputs(games, two_teams(1987030999, 1986030411))
        nhl_serving_finals.run(base, out)
        self.assertEqual(self.flagged(out), [1986030411])

    def test_nothing_flagged_before_1926_27(self):
        games = [(1925030111, 19251926, 3, 1), (1925030411, 19251926, 3, 4),
                 (1926030411, 19261927, 3, 4)]
        sides = two_teams(1925030111, 1925030411, 1926030411)
        base, out = make_inputs(games, sides)
        nhl_serving_finals.run(base, out)
        self.assertEqual(self.flagged(out), [1926030411])

    def test_final_with_other_than_two_teams_fails(self):
        games = [(1951030411, 19511952, 3, 4)]
        sides = [(1951030411, 1), (1951030411, 2), (1951030411, 3)]
        base, out = make_inputs(games, sides)
        with self.assertRaises(ValueError):
            nhl_serving_finals.run(base, out)

    def test_final_with_one_team_fails(self):
        games = [(1951030411, 19511952, 3, 4)]
        base, out = make_inputs(games, [(1951030411, 1)])
        with self.assertRaises(ValueError):
            nhl_serving_finals.run(base, out)


if __name__ == "__main__":
    unittest.main()
