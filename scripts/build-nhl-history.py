"""Rebuild the game-side NHL appearance database from local official reports."""
import argparse
from collections import defaultdict
from datetime import date
import gzip
import hashlib
import json
from pathlib import Path
import sqlite3

from check_nhl_history import check


SCHEMA = """
CREATE TABLE IF NOT EXISTS partitions (
    season_id INTEGER, game_type INTEGER, sha256 TEXT NOT NULL, fetched_at TEXT NOT NULL,
    sources TEXT NOT NULL, PRIMARY KEY(season_id, game_type)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS game_sides (
    game_id INTEGER, team_id INTEGER, season_id INTEGER NOT NULL, game_type INTEGER NOT NULL,
    game_date TEXT NOT NULL, team TEXT NOT NULL, team_name TEXT NOT NULL,
    home_road TEXT CHECK(home_road IN ('H','R')), opponent_id INTEGER NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('team-summary','player-summary')),
    PRIMARY KEY(game_id, team_id), UNIQUE(game_id, home_road),
    FOREIGN KEY(season_id, game_type) REFERENCES partitions ON DELETE CASCADE
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS sides_by_partition ON game_sides(season_id,game_type);
CREATE TABLE IF NOT EXISTS appearances (
    season_id INTEGER NOT NULL, game_type INTEGER NOT NULL, game_id INTEGER, team_id INTEGER,
    team TEXT NOT NULL, player_id INTEGER, name TEXT NOT NULL,
    role TEXT CHECK(role IN ('skater','goalie')) NOT NULL,
    PRIMARY KEY(game_id,team_id,player_id,role),
    FOREIGN KEY(game_id,team_id) REFERENCES game_sides ON DELETE CASCADE
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS source_disagreements (
    game_id INTEGER, team_id INTEGER, player_id INTEGER, role TEXT, reported_side TEXT,
    reported_date TEXT NOT NULL, PRIMARY KEY(game_id,team_id,player_id,role),
    FOREIGN KEY(game_id,team_id,player_id,role) REFERENCES appearances ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS player_games ON appearances(player_id,game_id);
"""


def require(condition, detail):
    if not condition:
        raise ValueError(detail)


def positive(value):
    return type(value) is int and value > 0


def project(db, data, season, kind):
    games = defaultdict(dict)
    for row in data["teams"]:
        game, side = row["gameId"], row["homeRoad"]
        require(positive(game) and game // 1000000 == season // 10000
                and game // 10000 % 100 == kind, f"unexpected game {game}")
        require(side in ("H", "R") and side not in games[game], f"duplicate/invalid side {game} {side}")
        require(row["gamesPlayed"] == 1 and positive(row["teamId"]), f"invalid team {game} {side}")
        games[game][side] = row

    by_team = {}
    identities = defaultdict(set)

    def add_side(game, team, opponent, team_id, opponent_id, team_name, game_date, side, source):
        date.fromisoformat(game_date)
        by_team[game, team] = (team_id, opponent, game_date, side)
        db.execute("INSERT INTO game_sides VALUES(?,?,?,?,?,?,?,?,?,?)",
                   (game, team_id, season, kind, game_date, team, team_name, side, opponent_id, source))

    for game, sides in games.items():
        require(set(sides) == {"H", "R"}, f"incomplete game {game}")
        for side, row in sides.items():
            opp = sides["R" if side == "H" else "H"]
            require(row["gameDate"] == opp["gameDate"] and row["teamId"] != opp["teamId"],
                    f"inconsistent sides {game}")
            team = opp["opponentTeamAbbrev"]
            identities[team].add((row["teamId"], row["teamFullName"]))
            add_side(game, team, row["opponentTeamAbbrev"], row["teamId"], opp["teamId"],
                     row["teamFullName"], row["gameDate"], side, "team-summary")

    # A suspended game can credit players even when no result counts for either club.
    unlisted = defaultdict(set)
    for role in ("skaters", "goalies"):
        for row in data[role]:
            if row["gameId"] not in games and row["gamesPlayed"] == 1:
                unlisted[row["gameId"]].add((row["teamAbbrev"], row["opponentTeamAbbrev"], row["gameDate"]))
    for game, reports in unlisted.items():
        require(positive(game) and game // 1000000 == season // 10000 and game // 10000 % 100 == kind,
                f"unexpected unlisted game {game}")
        require(len(reports) == 2, f"ambiguous credited teams for unlisted game {game}")
        for team, opponent, game_date in reports:
            require(team != opponent and (opponent, team, game_date) in reports
                    and len(identities[team]) == len(identities[opponent]) == 1,
                    f"ambiguous identities for unlisted game {game}")
            (team_id, name), = identities[team]
            (opponent_id, _), = identities[opponent]
            add_side(game, team, opponent, team_id, opponent_id, name, game_date, None, "player-summary")

    def appearances(records, role):
        for row in records:
            require(type(row["gamesPlayed"]) is int and row["gamesPlayed"] in (0, 1),
                    f"invalid gamesPlayed {row}")
            if row["gamesPlayed"] == 0:
                continue
            game, side = row["gameId"], row["homeRoad"]
            club = by_team.get((game, row["teamAbbrev"]))
            require(club and club[1] == row["opponentTeamAbbrev"], f"appearance side mismatch {row}")
            team_id, _, game_date, team_side = club
            if row["gameDate"] != game_date or side != team_side:
                db.execute("INSERT INTO source_disagreements VALUES(?,?,?,?,?,?)",
                           (game, team_id, row["playerId"], role, side, row["gameDate"]))
            name = row[role + "FullName"]
            require(positive(row["playerId"]) and isinstance(name, str) and name.strip(),
                    f"invalid player {row}")
            yield season, kind, game, team_id, row["teamAbbrev"], row["playerId"], name, role

    for role in ("skater", "goalie"):
        db.executemany("INSERT INTO appearances VALUES(?,?,?,?,?,?,?,?)",
                       appearances(data[role + "s"], role))


def build(root, db):
    catalog = json.loads((root / "seasons.json").read_text())
    ids = [row["id"] for row in catalog["data"]]
    require(ids and len(ids) == catalog["total"] == len(set(ids)) and all(map(positive, ids)),
            "incomplete season catalog")
    archives = {(s, k): root / "seasons" / f"{s}-{k}.json.gz" for s in ids for k in (2, 3)}
    missing = [p.name for p in archives.values() if not p.is_file()]
    require(not missing, f"missing {len(missing)} archives: {missing[:5]}")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript(SCHEMA)
    changed = 0
    with db:
        db.execute("BEGIN IMMEDIATE")
        existing = {(s, k): h for s, k, h in db.execute("SELECT season_id,game_type,sha256 FROM partitions")}
        require(not existing.keys() - archives.keys(), "database contains seasons outside the catalog")
        for (season, kind), path in sorted(archives.items()):
            contents = path.read_bytes()
            digest = hashlib.sha256(contents).hexdigest()
            if existing.get((season, kind)) == digest:
                continue
            try:
                data = json.loads(gzip.decompress(contents))
                require((data["seasonId"], data["gameType"]) == (season, kind), "partition mismatch")
                require(isinstance(data["sources"], list) and data["sources"], "missing source URLs")
                db.execute("DELETE FROM partitions WHERE season_id=? AND game_type=?", (season, kind))
                db.execute("INSERT INTO partitions VALUES(?,?,?,?,?)",
                           (season, kind, digest, data["fetchedAt"], json.dumps(data["sources"])))
                project(db, data, season, kind)
            except (KeyError, ValueError, sqlite3.Error) as exc:
                raise ValueError(f"{path.name}: {exc}") from exc
            changed += 1
        with gzip.open(root / "season-totals.json.gz", "rt") as stream:
            report = check(db, json.load(stream))
        issues = {key: value[:12] for key, value in report.items()
                  if key in ("differences", "duplicates", "missingPartitions", "unexpectedPartitions") and value}
        require(not issues, f"NHL season reconciliation failed: {issues}")
    return changed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("data/history"))
    parser.add_argument("--db", type=Path)
    args = parser.parse_args()
    with sqlite3.connect(args.db or args.root / "nhl.sqlite") as connection:
        print(f"Rebuilt {build(args.root, connection)} partitions.")
