"""Reconcile game appearances with independent NHL season summary reports."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from urllib.parse import urlencode

BASE = "https://api.nhle.com/stats/rest/en"


def fetch_report(endpoint, **params):
    url = f"{BASE}/{endpoint}?{urlencode(params)}"
    response = subprocess.check_output([
        "curl", "-fsSL", "--retry", "3", "--max-time", "90", url
    ])
    report = json.loads(response)
    if len(report["data"]) != report["total"]:
        raise ValueError(f"Incomplete NHL response for {url}")
    return report["data"]


def verify_seasons(seasons):
    if not seasons or not all(type(s) is int for s in seasons):
        raise ValueError("Invalid season catalog")
    # The NHL cancelled the entire 2004–05 season.
    expected = [year * 10000 + year + 1 for year in range(1917, max(seasons) // 10000 + 1) if year != 2004]
    if seasons != expected:
        raise ValueError("Unexpected gaps or duplicate seasons in the NHL catalog")


def partitions(seasons):
    return [(season, kind, role) for season in seasons
            for kind in (2, 3) for role in ("goalie", "skater")]


def season_totals(partition):
    season, kind, role = partition
    rows = fetch_report(f"{role}/summary", limit=-1,
                        cayenneExp=f"seasonId={season} and gameTypeId={kind}")
    players = {}
    for row in rows:
        player, count = row["playerId"], row["gamesPlayed"]
        if row["seasonId"] != season or player in players or type(count) != int or count < 0:
            raise ValueError(f"Invalid summary for {partition}: {row}")
        players[player] = count
    return [season, kind, role, sorted(players.items())]


def refresh(path):
    seasons = sorted(row["id"] for row in fetch_report("season", limit=-1))
    verify_seasons(seasons)
    with ThreadPoolExecutor(max_workers=3) as pool:
        reports = list(pool.map(season_totals, partitions(seasons)))
    snapshot = dict(fetchedAt=datetime.now(timezone.utc).isoformat(),
                    source=BASE, seasons=seasons, reports=reports)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp.write(gzip.compress(json.dumps(snapshot, separators=(",", ":")).encode(), mtime=0))
    Path(tmp.name).replace(path)


def check(db, snapshot):
    verify_seasons(snapshot["seasons"])
    expected = {}
    coverage = []
    zero_game_reports = {"goalie": 0, "skater": 0}
    for season, kind, role, players in snapshot["reports"]:
        coverage.append((season, kind, role))
        for player, count in players:
            if count:
                expected[season, kind, role, player] = count
            else:
                zero_game_reports[role] += 1
    if sorted(coverage) != sorted(partitions(snapshot["seasons"])):
        raise ValueError("Cached summary reports have missing or duplicate partitions")
    loaded = set(db.execute("SELECT season_id, game_type FROM partitions"))
    required = {(season, kind) for season, kind, _ in coverage}
    actual = {tuple(row[:4]): row[4] for row in db.execute("""
        SELECT season_id, game_type, role, player_id, COUNT(*)
        FROM appearances GROUP BY season_id, game_type, role, player_id
    """)}
    duplicates = db.execute("""
        SELECT game_id, team_id, player_id, role, COUNT(*) FROM appearances
        GROUP BY game_id, team_id, player_id, role HAVING COUNT(*) > 1
    """).fetchall()
    dual_roles = db.execute("""
        SELECT COUNT(*) FROM appearances skater
        JOIN appearances goalie USING (game_id, team_id, player_id)
        WHERE skater.role = 'skater' AND goalie.role = 'goalie'
    """).fetchone()[0]
    differences = [dict(season=key[0], gameType=key[1], role=key[2],
                        playerId=key[3], expected=expected.get(key, 0), actual=actual.get(key, 0))
                   for key in sorted(expected.keys() | actual.keys())
                   if expected.get(key, 0) != actual.get(key, 0)]
    return dict(summaryFetchedAt=snapshot["fetchedAt"], seasons=len(snapshot["seasons"]),
                officialAppearances=sum(expected.values()), importedAppearances=sum(actual.values()),
                missingPartitions=sorted(required - loaded), unexpectedPartitions=sorted(loaded - required),
                dualRoleAppearances=dual_roles, zeroGameSummaryRows=zero_game_reports, differences=differences, duplicates=duplicates)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path, nargs="?")
    parser.add_argument("--fetch", action="store_true", help="refresh the NHL summary snapshot")
    parser.add_argument("--totals", type=Path, default=Path("data/history/season-totals.json.gz"))
    args = parser.parse_args()
    if args.fetch:
        refresh(args.totals)
    if args.database is None:
        if args.fetch:
            return 0
        parser.error("provide a database to check")
    with gzip.open(args.totals, "rt") as stream:
        snapshot = json.load(stream)
    with sqlite3.connect(args.database.resolve().as_uri() + "?mode=ro", uri=True) as db:
        db.execute("BEGIN")
        report = check(db, snapshot)
    print(json.dumps(report, indent=2))
    return int(any(report[key] for key in ("differences", "duplicates", "missingPartitions", "unexpectedPartitions")))


if __name__ == "__main__":
    raise SystemExit(main())
