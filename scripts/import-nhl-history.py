"""Archive official NHL team and player game reports, one file per season and game type."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
import json
import os
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1] / "data/history"
API = "https://api.nhle.com/stats/rest/en"


def report(path, expression=None):
    query = urlencode({"isGame": "true", "limit": -1, "cayenneExp": expression}) if expression else ""
    url = f"{API}/{path}" + (f"?{query}" if query else "")
    raw = subprocess.check_output([
        "curl", "--fail", "--silent", "--show-error", "--compressed", "--max-time", "120",
        "--retry", "4", url,
    ])
    payload = json.loads(raw)
    if not isinstance(payload["data"], list) or len(payload["data"]) != payload["total"]:
        raise ValueError(f"Incomplete report at {url}")
    if len(payload["data"]) >= 10000:
        raise ValueError(f"Report reached the NHL row limit at {url}")
    return url, payload


def save(path, payload, compressed=False):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temp:
        temporary = Path(temp.name)
    try:
        opener = gzip.open if compressed else open
        options = {"compresslevel": 4} if compressed else {}
        with opener(temporary, "wt", encoding="utf-8", **options) as file:
            json.dump(payload, file, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
            file.write("\n")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def archive(season, game_type):
    expression = f"seasonId={season} and gameTypeId={game_type}"
    sources = []

    def get(path, extra=""):
        url, response = report(path + "/summary", expression + extra)
        sources.append(url)
        return response["data"]

    teams = get("team")
    game_ids = sorted({row["gameId"] for row in teams})
    # Leave both outer ranges open so an appearance missing from team reports survives.
    cuts = game_ids[200::200]
    skaters = []
    for low, high in zip([None, *cuts], [*cuts, None]):
        bounds = (f" and gameId>={low}" if low else "") + (f" and gameId<{high}" if high else "")
        skaters.extend(get("skater", bounds))
    goalies = get("goalie")
    snapshot = {
        "seasonId": season, "gameType": game_type,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "sources": sources, "teams": teams, "skaters": skaters, "goalies": goalies,
    }
    path = ROOT / "seasons" / f"{season}-{game_type}.json.gz"
    save(path, snapshot, compressed=True)
    return f"{season}/{game_type}  {len(game_ids)} games, {len(skaters)} skater and {len(goalies)} goalie rows"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="also fetch previously archived historical seasons")
    parser.add_argument("--season", type=int, help="refresh just this NHL season ID, e.g. 20232024")
    args = parser.parse_args()
    directory = ROOT / "seasons"
    directory.mkdir(parents=True, exist_ok=True)
    _, catalog = report("season")
    seasons = sorted(row["id"] for row in catalog["data"])
    if not seasons or seasons[0] != 19171918 or len(seasons) != len(set(seasons)):
        raise ValueError("Unexpected NHL season catalog")
    if args.season is not None and args.season not in seasons:
        parser.error("season is absent from the NHL catalog")
    save(ROOT / "seasons.json", catalog)
    # Refresh last year's final games even if the site was offline when the season changed.
    recent = set(seasons[-2:])
    work = [(s, t) for s in seasons for t in (2, 3)
            if (s == args.season if args.season is not None else
                args.refresh or s in recent or not (directory / f"{s}-{t}.json.gz").exists())]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(lambda item: archive(*item), work):
            print(result, flush=True)


if __name__ == "__main__":
    main()
