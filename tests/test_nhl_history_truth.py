from collections import Counter
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

from scripts import nhl_history_truth as truth


SCHEMA = """
CREATE TABLE game_sides (
    game_id INTEGER, team_id INTEGER, season_id INTEGER, game_type INTEGER,
    game_date TEXT, team TEXT, team_name TEXT, home_road TEXT, opponent_id INTEGER,
    source TEXT, PRIMARY KEY (game_id, team_id)
);
CREATE TABLE appearances (
    season_id INTEGER, game_type INTEGER, game_id INTEGER, team_id INTEGER,
    team TEXT, player_id INTEGER, name TEXT, role TEXT,
    PRIMARY KEY (game_id, team_id, player_id, role)
);
CREATE TABLE dressed_goalies (
    game_id INTEGER, team_id INTEGER, player_id INTEGER,
    PRIMARY KEY (game_id, team_id, player_id)
);
"""
A, B, C, E, D, F, G, H = (
    1950020001, 1950020002, 1950020003, 1951020001,
    1951020002, 1951020003, 1951030111, 1951030112,
)


def add_game(db, game, date, sides):
    year = game // 1000000
    season = year * 10000 + year + 1
    kind = game // 10000 % 100
    for (team, players), (opponent, _) in (sides, sides[::-1]):
        db.execute(
            "INSERT INTO game_sides VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'team-summary')",
            (game, team, season, kind, date, str(team), str(team), opponent),
        )
        db.executemany(
            "INSERT INTO appearances VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (season, kind, game, team, str(team), player, name,
                 "goalie" if player in (16, 17) else "skater")
                for player, name in players
            ],
        )


def mini_league(db):
    db.executescript(SCHEMA)
    games = (
        (A, 1, (11, 12), 3, (15, 16), (16,)),
        (B, 1, (11, 12), 3, (15, 16), (16,)),
        (C, 1, (11, 13), 4, (19, 20), ()),
        (E, 2, (12, 14), 3, (16,), (16, 17)),
        (D, 2, (12, 14), 3, (17, 18), (16, 17)),
        (F, 2, (13, 14), 3, (16,), (16, 17)),
        (G, 2, (14, 15), 3, (16,), (16, 21)),
        (H, 2, (14, 15), 3, (16,), (16,)),
    )
    for index, (game, home, local, away, visitors, goalies) in enumerate(games, 1):
        date = f"{game // 1000000}-10-{index:02}"
        add_game(db, game, date, (
            (home, [(p, f"Player {p}") for p in local]),
            (away, [(p, f"Player {p}") for p in visitors]),
        ))
        db.executemany("INSERT INTO dressed_goalies VALUES (?, ?, ?)", [
            (game, away, player) for player in goalies
        ])


class MiniLeagueTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        mini_league(self.db)
        self.players = truth.credited_players(self.db)
        self.relations = truth.collect_relations(self.db, self.players)
        self.off = truth.make_graph(self.players, self.relations.shared)
        self.on = truth.make_graph(self.players, self.relations.shared + self.relations.partners)

    def test_links_and_spans(self):
        self.assertEqual(self.players, set(range(11, 21)))
        expected = {
            ((11, 12), 19501951, 2, 1): (2, A),
            ((11, 13), 19501951, 2, 1): (1, C),
            ((15, 16), 19501951, 2, 3): (2, A),
            ((19, 20), 19501951, 2, 4): (1, C),
            ((12, 14), 19511952, 2, 2): (2, E),
            ((13, 14), 19511952, 2, 2): (1, F),
            ((17, 18), 19511952, 2, 3): (1, D),
            ((14, 15), 19511952, 3, 2): (2, G),
        }
        self.assertEqual(self.relations.shared, {
            pair: games for (pair, _, _, _), (games, _) in expected.items()
        })
        self.assertEqual({
            key: (span.games, span.first) for key, span in self.relations.shared_spans.items()
        }, expected)
        self.assertEqual(self.relations.partners, {(16, 17): 3})
        self.assertEqual({
            key: (span.games, span.first) for key, span in self.relations.partner_spans.items()
        }, {((16, 17), 19511952, 2, 3): (3, E)})

    def test_opponent_pairs(self):
        self.assertEqual(self.relations.opponents, {
            (11, 15): 2, (11, 16): 2, (11, 19): 1, (11, 20): 1,
            (12, 15): 2, (12, 16): 3, (12, 17): 1, (12, 18): 1,
            (13, 16): 1, (13, 19): 1, (13, 20): 1,
            (14, 16): 4, (14, 17): 1, (14, 18): 1, (15, 16): 2,
        })
        opponents = truth.make_graph(self.players, self.relations.opponents)
        self.assertEqual(list(opponents[16].items()), [(14, 4), (12, 3), (11, 2), (15, 2), (13, 1)])
        self.assertEqual(truth.breadth_first(opponents, 11).answer(19), {"distance": 1, "chains": 1})
        either = truth.make_graph(
            self.players, self.relations.shared + self.relations.partners + self.relations.opponents
        )
        search = truth.breadth_first(either, 11)
        self.assertEqual(search.answer(18), {"distance": 2, "chains": 1})
        self.assertEqual(search.first_chain(18), [11, 12, 18])

    def test_shortest_chains(self):
        for graph in (self.off, self.on):
            search = truth.breadth_first(graph, 11)
            self.assertEqual(search.answer(14), {"distance": 2, "chains": 2})
            self.assertEqual(search.first_chain(14), [11, 12, 14])
            self.assertEqual(search.answer(16), {"distance": 4, "chains": 2})
            self.assertEqual(search.first_chain(16), [11, 12, 14, 15, 16])
            self.assertEqual(search.answer(19), {"distance": None, "chains": 0})
        self.assertEqual(truth.breadth_first(self.on, 11).answer(18), {"distance": 6, "chains": 2})
        self.assertEqual(truth.breadth_first(self.off, 11).answer(18), {"distance": None, "chains": 0})
        with self.assertRaises(KeyError):
            truth.breadth_first(self.on, 99)

    def test_farthest(self):
        self.assertEqual(truth.farthest(self.on, 11), {
            "distance": 6, "players": [18], "reachable": 7, "unreachable": 2,
        })
        self.assertEqual(truth.farthest(self.off, 11), {
            "distance": 4, "players": [16], "reachable": 5, "unreachable": 4,
        })

    def test_regular_season_and_season_subgraphs(self):
        regular_counts = Counter()
        later_counts = Counter()
        for (pair, season, kind, _), span in self.relations.shared_spans.items():
            if kind == 2:
                regular_counts[pair] += span.games
            if season == 19511952:
                later_counts[pair] += span.games
        regular = truth.make_graph(self.players, regular_counts)
        later = truth.make_graph(self.players, later_counts)
        self.assertEqual(truth.breadth_first(regular, 11).answer(15), {"distance": None, "chains": 0})
        self.assertEqual(truth.breadth_first(later, 12).first_chain(13), [12, 14, 13])
        self.assertEqual(truth.breadth_first(later, 11).answer(14), {"distance": None, "chains": 0})

    def test_missing_dressed_table(self):
        self.db.execute("DROP TABLE dressed_goalies")
        report = truth.build_truth(self.db)
        self.assertFalse(report["dressed_goalies_available"])
        self.assertEqual(report["partner_spans"], 0)
        self.assertEqual(report["partner_added_pairs"], 0)
        self.assertEqual(len(report["pairs"]), 45)
        self.assertTrue(all(pair["partners_on"] == pair["partners_off"] for pair in report["pairs"]))

    def test_duplicate_role_credits_and_two_credited_goalies(self):
        self.db.execute(
            "INSERT INTO appearances VALUES (19501951, 2, ?, 3, '3', 15, 'Player 15', 'goalie')",
            (A,),
        )
        self.db.execute("INSERT INTO dressed_goalies VALUES (?, 3, 15)", (A,))
        self.assertEqual(truth.collect_relations(self.db, self.players), self.relations)

    def test_cli_writes_truth_json(self):
        with TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "base #1.sqlite"
            out_path = Path(tmp) / "truth.json"
            with closing(sqlite3.connect(db_path)) as db:
                mini_league(db)
                db.commit()
            command = [
                sys.executable, str(Path(truth.__file__)), "--db", str(db_path),
                "--out", str(out_path), "--seed", "17", "--pairs", "12",
            ]
            subprocess.run(command, check=True, capture_output=True, text=True)
            report = json.loads(out_path.read_text())
            self.assertEqual(report["player_count"], 10)
            self.assertEqual(report["shared_game_pairs"], 8)
            self.assertEqual(report["shared_game_spans"], 8)
            self.assertEqual(report["opponent_pairs"], 15)
            self.assertEqual(report["partner_spans"], 1)
            self.assertEqual(report["partner_added_pairs"], 1)
            self.assertEqual(report["components"], 3)
            self.assertEqual(report["components_partners_on"], 2)
            self.assertEqual(report["diameter_partners_off"], 4)
            self.assertEqual(report["cup_final_seasons"], {
                "count": 1, "teams_by_season": {"19511952": [2, 3]},
            })
            self.assertEqual(report["seed"], 17)
            pairs = report["pairs"]
            self.assertEqual(len({(pair["a"], pair["b"]) for pair in pairs}), 12)
            for pair in pairs:
                for mode, graph in (("partners_on", self.on), ("partners_off", self.off)):
                    self.assertEqual(pair[mode], truth.breadth_first(graph, pair["a"]).answer(pair["b"]))
            subprocess.run(command + ["--skip-diameter"], check=True, capture_output=True, text=True)
            skipped = json.loads(out_path.read_text())
            self.assertIsNone(skipped["diameter_partners_off"])
            self.assertEqual(skipped["components"], 3)
            self.assertEqual(skipped["pairs"], pairs)


class HistoricalCasesTest(unittest.TestCase):
    def test_named_pair_and_single_game_answers(self):
        with closing(sqlite3.connect(":memory:")) as db:
            db.executescript(SCHEMA)
            cases = (
                (1918020026, [(1, "Sprague Cleghorn"), (2, "Skater")], []),
                (2015020001, [(3, "Ryan Johansen")], [(4, "Seth Jones")]),
                (2024020001, [(5, "Adin Hill")], []),
                (2024020002, [(6, "Ilya Samsonov")], []),
                (2024020003, [(7, "Bill Ranford")], [(8, "Curtis Joseph")]),
                (2024020004, [(9, "Connor McDavid"), (10, "Leon Draisaitl")], []),
                (2024020005, [(10, "Leon Draisaitl"), (11, "Ted Lindsay")], []),
            )
            for game, local, visitors in cases:
                add_game(db, game, "2025-01-01", ((1, local), (2, visitors)))
            db.executemany("INSERT INTO dressed_goalies VALUES (2024020001, 1, ?)", [(5,), (6,)])
            report = truth.build_truth(db, pairs=0)
            self.assertEqual(report["cleghorn_1918020026"], [
                {"team_id": 1, "teammate_id": 2, "shared_games": 1},
            ])
            self.assertEqual(report["johansen_jones_2015_16_shared_games"], 0)
            self.assertEqual(report["mcdavid_teammates"], 1)
            self.assertEqual(report["mcdavid_lindsay_distance"], 2)
            self.assertEqual(report["mcdavid_draisaitl_games"], 1)
            self.assertEqual(report["hill_samsonov"], {
                "shared_games": 0, "partner_games": 1, "partner_spans": [
                    {"season_id": 20242025, "game_type": 2, "team_id": 1,
                     "games": 1, "first_game_id": 2024020001},
                ],
            })
            self.assertEqual(report["ranford_joseph"], {
                "shared_games": 0, "partner_games": 0, "partner_spans": [],
            })
            db.execute("DROP TABLE dressed_goalies")
            self.assertEqual(truth.build_truth(db, pairs=0)["hill_samsonov"], {
                "shared_games": 0, "partner_games": None, "partner_spans": None,
                "coverage": "no dressed_goalies rows for seasons [20242025]",
            })
            # An empty table is missing coverage too, not a confirmed zero.
            db.execute("CREATE TABLE dressed_goalies (game_id INTEGER, team_id INTEGER, player_id INTEGER)")
            empty = truth.build_truth(db, pairs=0)
            self.assertFalse(empty["dressed_goalies_available"])
            self.assertIsNone(empty["ranford_joseph"]["partner_games"])

    def test_span_first_game_is_lowest_id_not_earliest_date(self):
        with closing(sqlite3.connect(":memory:")) as db:
            db.executescript(SCHEMA)
            # Game 2024020002 was played before 2024020001.
            for game, date in ((2024020001, "2025-02-01"), (2024020002, "2025-01-01")):
                add_game(db, game, date, ((1, [(1, "Player 1"), (2, "Player 2")]), (2, [(3, "Player 3")])))
            relations = truth.collect_relations(db, {1, 2, 3})
            (span,) = relations.shared_spans.values()
            self.assertEqual((span.games, span.first), (2, 2024020001))

    def test_name_resolution_finals_and_coverage(self):
        with closing(sqlite3.connect(":memory:")) as db:
            db.executescript(SCHEMA)
            jagr = "Jaromír Jágr"
            for game, local in (
                (1925030111, [(12, "Teammate")]),
                (1926030111, [(12, "Teammate")]),
                (1979020001, [(11, "Jaromir Jagr"), (12, "Teammate")]),
                (1979030111, [(99, jagr)]),
                (1979030811, [(12, "Teammate")]),
                (1979030911, [(99, jagr)]),
                (1987020001, [(11, "Jaromir Jagr")]),
                (1987020002, [(11, "J. Jagr")]),
                (1987030411, [(13, "Skater")]),
                (1987030999, [(12, "Teammate")]),
                (2021030411, [(13, "Skater")]),
            ):
                add_game(db, game, "1980-01-01", ((1, local), (2, [(20, "Opponent")])))
            report = truth.build_truth(db, pairs=0)
            self.assertEqual(report["players"][jagr], 11)
            self.assertEqual(report["jagr_teammates"], 1)
            self.assertEqual(report["jagr_finals_1980_2026"], {
                "covered_years": [1980, 1988], "missing_years": [2022],
            })
            self.assertEqual(report["cup_final_seasons"], {
                "count": 4,
                "teams_by_season": dict.fromkeys(("19261927", "19791980", "19871988", "20212022"), [1, 2]),
            })
            _, final_games = truth.cup_finals(db)
            self.assertEqual(final_games, {1926030111, 1979030811, 1987030411, 1987030999, 2021030411})


if __name__ == "__main__":
    unittest.main()
