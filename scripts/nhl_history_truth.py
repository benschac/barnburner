"""Derive the teammate graph acceptance answers directly from the base SQLite file."""

from argparse import ArgumentParser
from collections import Counter
from contextlib import closing
from dataclasses import dataclass, field
from itertools import combinations, groupby, islice
import json
from pathlib import Path
from random import Random
import sqlite3


PLAYER_NAMES = (
    "Connor McDavid", "Leon Draisaitl", "Ted Lindsay", "Jaromír Jágr",
    "Ryan Johansen", "Seth Jones", "Sprague Cleghorn", "Adin Hill",
    "Ilya Samsonov", "Bill Ranford", "Curtis Joseph",
)
CLEGHORN_GAME = 1918020026

Pair = tuple[int, int]
SpanKey = tuple[Pair, int, int, int]
Graph = dict[int, dict[int, int]]


@dataclass(slots=True)
class Span:
    games: int
    first: tuple[str, int]


@dataclass
class Relations:
    shared: Counter[Pair] = field(default_factory=Counter)
    shared_spans: dict[SpanKey, Span] = field(default_factory=dict)
    opponents: Counter[Pair] = field(default_factory=Counter)
    partners: Counter[Pair] = field(default_factory=Counter)
    partner_spans: dict[SpanKey, Span] = field(default_factory=dict)
    dressed_available: bool = False


def pair_key(a, b):
    return (a, b) if a < b else (b, a)


def credited_players(db):
    return {
        player for (player,) in db.execute(
            "SELECT DISTINCT player_id FROM appearances WHERE game_type IN (2, 3)"
        )
    }


def resolve_players(db):
    matches = {}
    spellings = [(name, name) for name in PLAYER_NAMES] + [("Jaromír Jágr", "Jaromir Jagr")]
    placeholders = ", ".join("(?, ?)" for _ in spellings)
    for name, player in db.execute(
        f"""
        WITH requested(name, spelling) AS (VALUES {placeholders}),
        candidates AS (
            SELECT DISTINCT requested.name, a.player_id
            FROM appearances AS a JOIN requested ON a.name = requested.spelling
            WHERE a.game_type IN (2, 3)
        )
        SELECT name, player_id FROM candidates
        ORDER BY name, (
            SELECT COUNT(DISTINCT a.game_id)
            FROM appearances AS a
            WHERE a.player_id = candidates.player_id AND a.game_type IN (2, 3)
        ) DESC, player_id
        """,
        tuple(value for spelling in spellings for value in spelling),
    ):
        matches.setdefault(name, player)
    return {name: matches.get(name) for name in PLAYER_NAMES}


def add_game(counts, spans, pair, season, kind, team, evidence):
    counts[pair] += 1
    key = (pair, season, kind, team)
    span = spans.get(key)
    if span is None:
        spans[key] = Span(1, evidence)
    else:
        span.games += 1
        span.first = min(span.first, evidence)


def collect_relations(db, players):
    relations = Relations()
    relations.dressed_available = db.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'dressed_goalies'"
    ).fetchone() is not None
    rows = """
        SELECT game_id, team_id, player_id, 0 AS dressed
        FROM appearances WHERE game_type IN (2, 3)
    """
    if relations.dressed_available:
        rows += """
            UNION ALL
            SELECT game_id, team_id, player_id, 1 AS dressed FROM dressed_goalies
        """
    sides = db.execute(
        f"""
        SELECT g.game_id, g.team_id, g.season_id, g.game_type, g.game_date,
               credits.player_id, credits.dressed
        FROM ({rows}) AS credits
        JOIN game_sides AS g USING (game_id, team_id)
        WHERE g.game_type IN (2, 3)
        ORDER BY g.game_id, g.team_id
        """
    )
    for game, game_rows in groupby(sides, key=lambda row: row[0]):
        credited_sides = []
        opponent_pairs = set()
        for team, side_rows in groupby(game_rows, key=lambda row: row[1]):
            credited = set()
            dressed = set()
            for _, _, season, kind, date, player, is_dressed in side_rows:
                if not is_dressed:
                    credited.add(player)
                elif player in players:
                    dressed.add(player)
            evidence = (date, game)
            for pair in combinations(sorted(credited), 2):
                add_game(relations.shared, relations.shared_spans, pair,
                         season, kind, team, evidence)
            for a, b in combinations(sorted(dressed), 2):
                if a not in credited or b not in credited:
                    add_game(relations.partners, relations.partner_spans, (a, b),
                             season, kind, team, evidence)
            for other in credited_sides:
                opponent_pairs.update(
                    pair_key(a, b) for a in credited for b in other if a != b
                )
            credited_sides.append(credited)
        relations.opponents.update(opponent_pairs)
    return relations


def make_graph(players, counts) -> Graph:
    graph = {player: {} for player in sorted(players)}
    for (a, b), games in counts.items():
        graph[a][b] = games
        graph[b][a] = games
    return {
        player: dict(sorted(neighbors.items(), key=lambda edge: (-edge[1], edge[0])))
        for player, neighbors in graph.items()
    }


@dataclass
class Search:
    distances: dict[int, int]
    chains: dict[int, int]
    parents: dict[int, int]

    def answer(self, target):
        return {"distance": self.distances.get(target), "chains": self.chains.get(target, 0)}

    def first_chain(self, target):
        if target not in self.distances:
            return None
        chain = [target]
        while target in self.parents:
            target = self.parents[target]
            chain.append(target)
        return chain[::-1]


def breadth_first(graph: Graph, start, targets=None):
    if start not in graph:
        raise KeyError(start)
    distances = {start: 0}
    chains = {start: 1}
    parents = {}
    frontier = [start]
    depth = 0
    while frontier:
        if targets is not None and targets <= distances.keys():
            break
        depth += 1
        following = []
        for player in frontier:
            for neighbor in graph[player]:
                if neighbor not in distances:
                    distances[neighbor] = depth
                    chains[neighbor] = 0
                    parents[neighbor] = player
                    following.append(neighbor)
                if distances[neighbor] == depth:
                    chains[neighbor] += chains[player]
        frontier = following
    return Search(distances, chains, parents)


def farthest(graph, start):
    distances = breadth_first(graph, start).distances
    distance = max(distances.values())
    return {
        "distance": distance,
        "players": sorted(p for p, d in distances.items() if d == distance and p != start),
        "reachable": len(distances) - 1,
        "unreachable": len(graph) - len(distances),
    }


def graph_metrics(graph, skip_diameter):
    # Set frontiers avoid counting paths on every all-pairs search.
    neighbors = {player: set(edges) for player, edges in graph.items()}
    remaining = set(graph)
    components = 0
    diameter = 0
    for start in graph:
        if skip_diameter and start not in remaining:
            continue
        unseen = neighbors.keys() - {start}
        frontier = {start}
        depth = 0
        while unseen:
            frontier = unseen.intersection(set().union(*(neighbors[p] for p in frontier)))
            if not frontier:
                break
            unseen.difference_update(frontier)
            depth += 1
        if start in remaining:
            components += 1
            remaining.intersection_update(unseen)
        diameter = max(diameter, depth)
    return components, None if skip_diameter else diameter


def cup_finals(db):
    games = list(db.execute(
        """
        SELECT season_id, game_id, team_id
        FROM game_sides WHERE game_type = 3 AND season_id >= 19261927
        ORDER BY season_id, game_id, team_id
        """
    ))
    highest_round = {}
    for season, game, _ in games:
        round_number = (game // 100) % 10
        if 1 <= round_number <= 8:
            highest_round[season] = max(highest_round.get(season, 0), round_number)
    teams = {}
    final_games = set()
    for season, game, team in games:
        if game == 1987030999 or (game // 100) % 10 == highest_round.get(season):
            teams.setdefault(season, set()).add(team)
            final_games.add(game)
    return teams, final_games


def finals_coverage(db, teammates, final_teams, final_games):
    years = {season % 10000 for season in final_teams if 1980 <= season % 10000 <= 2026}
    covered = {
        season % 10000
        for season, game, player in db.execute(
            """
            SELECT season_id, game_id, player_id FROM appearances
            WHERE game_type = 3 AND season_id BETWEEN 19791980 AND 20252026
            """
        )
        if game in final_games and player in teammates
    }
    return {"covered_years": sorted(covered), "missing_years": sorted(years - covered)}


def sample_pairs(players, seed, count):
    players = sorted(players)
    total = len(players) * (len(players) - 1) // 2
    indices = sorted(Random(seed).sample(range(total), min(count, total)))
    pairs = combinations(players, 2)
    previous = -1
    for index in indices:
        yield next(islice(pairs, index - previous - 1, None))
        previous = index


def sampled_answers(graph_off, graph_on, seed, count):
    answers = []
    for a, pairs in groupby(sample_pairs(graph_off, seed, count), key=lambda pair: pair[0]):
        targets = {b for _, b in pairs}
        off = breadth_first(graph_off, a, targets)
        on = off if graph_on is graph_off else breadth_first(graph_on, a, targets)
        answers.extend(
            {"a": a, "b": b, "partners_on": on.answer(b), "partners_off": off.answer(b)}
            for b in sorted(targets)
        )
    return answers


def pair_report(relations, a, b):
    if a is None or b is None:
        return None
    pair = pair_key(a, b)
    spans = [
        {"season_id": season, "game_type": kind, "team_id": team,
         "games": span.games, "first_game_id": span.first[1]}
        for (players, season, kind, team), span in sorted(relations.partner_spans.items())
        if players == pair
    ]
    return {
        "shared_games": relations.shared[pair],
        "partner_games": relations.partners[pair],
        "partner_spans": spans if relations.dressed_available else None,
    }


def build_truth(db, seed=0, pairs=200, skip_diameter=False):
    players = credited_players(db)
    names = resolve_players(db)
    relations = collect_relations(db, players)
    graph_off = make_graph(players, relations.shared)
    graph_on = (
        make_graph(players, relations.shared + relations.partners)
        if relations.partners else graph_off
    )
    components, diameter = graph_metrics(graph_off, skip_diameter)
    components_on = components
    if graph_on is not graph_off:
        components_on, _ = graph_metrics(graph_on, skip_diameter=True)

    mcdavid = names["Connor McDavid"]
    lindsay = names["Ted Lindsay"]
    draisaitl = names["Leon Draisaitl"]
    jagr = names["Jaromír Jágr"]
    johansen = names["Ryan Johansen"]
    jones = names["Seth Jones"]
    cleghorn = names["Sprague Cleghorn"]

    cleghorn_games = None
    if cleghorn is not None:
        cleghorn_games = [
            {"team_id": team, "teammate_id": teammate, "shared_games": 1}
            for team, teammate in db.execute(
                """
                SELECT DISTINCT a.team_id, a.player_id
                FROM appearances AS a
                JOIN appearances AS c USING (game_id, team_id)
                WHERE c.game_id = ? AND c.player_id = ? AND a.player_id <> c.player_id
                ORDER BY a.team_id, a.player_id
                """,
                (CLEGHORN_GAME, cleghorn),
            )
        ]

    johansen_jones_games = None
    if johansen is not None and jones is not None:
        pair = pair_key(johansen, jones)
        johansen_jones_games = sum(
            span.games for (span_pair, season, _, _), span in relations.shared_spans.items()
            if span_pair == pair and season == 20152016
        )

    final_teams, final_games = cup_finals(db)
    return {
        "players": names,
        "player_count": len(players),
        "shared_game_pairs": len(relations.shared),
        "shared_game_spans": len(relations.shared_spans),
        "opponent_pairs": len(relations.opponents),
        "dressed_goalies_available": relations.dressed_available,
        "partner_spans": len(relations.partner_spans),
        "partner_added_pairs": len(relations.partners.keys() - relations.shared.keys()),
        "components": components,
        "components_partners_on": components_on,
        "diameter_partners_off": diameter,
        "mcdavid_teammates": len(graph_off[mcdavid]) if mcdavid is not None else None,
        "mcdavid_lindsay_distance": (
            breadth_first(graph_off, mcdavid, {lindsay}).answer(lindsay)["distance"]
            if mcdavid is not None and lindsay is not None else None
        ),
        "mcdavid_draisaitl_games": (
            relations.shared[pair_key(mcdavid, draisaitl)]
            if mcdavid is not None and draisaitl is not None else None
        ),
        "johansen_jones_2015_16_shared_games": johansen_jones_games,
        "cleghorn_1918020026": cleghorn_games,
        "hill_samsonov": pair_report(relations, names["Adin Hill"], names["Ilya Samsonov"]),
        "ranford_joseph": pair_report(relations, names["Bill Ranford"], names["Curtis Joseph"]),
        "jagr_teammates": len(graph_off[jagr]) if jagr is not None else None,
        "jagr_finals_1980_2026": (
            finals_coverage(db, graph_off[jagr], final_teams, final_games)
            if jagr is not None else None
        ),
        "cup_final_seasons": {"count": len(final_teams), "teams_by_season": {
            str(season): sorted(teams) for season, teams in final_teams.items()
        }},
        "seed": seed,
        "pairs": sampled_answers(graph_off, graph_on, seed, pairs),
    }


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--pairs", type=int, default=200)
    parser.add_argument("--skip-diameter", action="store_true")
    args = parser.parse_args()
    if args.pairs < 0:
        parser.error("--pairs must be nonnegative")
    db_path = args.db.resolve()
    out_path = args.out.resolve()
    if out_path == db_path or (
        out_path.exists() and db_path.exists() and out_path.samefile(db_path)
    ):
        parser.error("--out must differ from --db")
    if (Path(__file__).resolve().parents[1] / "data/history") in out_path.parents:
        parser.error("--out must be outside data/history")
    with closing(sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True)) as db:
        db.execute("BEGIN")
        truth = build_truth(db, args.seed, args.pairs, args.skip_diameter)
    out_path.write_text(json.dumps(truth, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
