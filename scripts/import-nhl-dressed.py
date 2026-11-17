"""Archive the goalies listed on each NHL box score, one file per season and game type."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / "data/history"
URL = "https://api-web.nhle.com/v1/gamecenter/{}/boxscore"
BATCH = 100
WORKERS = 4
ATTEMPTS = 5


class RateLimited(Exception):
    """The NHL answered HTTP 429."""


def http_fetch(url):
    """Return the parsed JSON body. Raise RateLimited on 429, any other error on failure."""
    request = urllib.request.Request(url, headers={"User-Agent": "nhl-history-archive"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 429:
            raise RateLimited(url) from error
        raise


def save(path, payload):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temp:
        temporary = Path(temp.name)
    try:
        with gzip.open(temporary, "wt", encoding="utf-8", compresslevel=4) as file:
            json.dump(payload, file, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
            file.write("\n")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def load(path):
    with gzip.open(path, "rt", encoding="utf-8") as file:
        return json.load(file)


def goalies(box):
    """Map team abbreviation to goalie list. A loaded box score without playerByGameStats lists no goalie."""
    stats = box.get("playerByGameStats") or {}
    result = {}
    for side in ("awayTeam", "homeTeam"):
        rows = (stats.get(side) or {}).get("goalies") or []
        result[box[side]["abbrev"]] = [{"playerId": r["playerId"], "toi": r.get("toi")} for r in rows]
    return result


class Fetcher:
    def __init__(self, fetch, sleep, wait=1.0):
        self.fetch, self.sleep, self.wait = fetch, sleep, wait
        self.pause_until = 0.0
        self.lock = threading.Lock()

    def game(self, game_id):
        """Return the goalies for one game, or None after the retries are used up."""
        delay = self.wait
        for attempt in range(ATTEMPTS):
            with self.lock:
                pause = self.pause_until - time.monotonic()
            if pause > 0:
                self.sleep(pause)
            try:
                return goalies(self.fetch(URL.format(game_id)))
            except RateLimited:
                # Slow every worker down; the response is never stored.
                with self.lock:
                    self.pause_until = max(self.pause_until, time.monotonic() + delay * 2)
            except Exception:
                pass
            if attempt < ATTEMPTS - 1:
                self.sleep(delay)
            delay *= 2
        return None


def run_season(source, target, fetcher, refresh=False, batch=BATCH, workers=WORKERS):
    season = load(source)
    game_ids = sorted({str(row["gameId"]) for row in season["teams"]})
    existing = load(target)["games"] if target.exists() else {}
    games = {g: existing[g] for g in game_ids if g in existing}
    todo = [g for g in game_ids if refresh or games.get(g) is None]
    skipped = len(game_ids) - len(todo)
    fetched = 0

    def write():
        save(target, {
            "seasonId": season["seasonId"], "gameType": season["gameType"],
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "games": {g: games[g] for g in game_ids if g in games},
        })

    with ThreadPoolExecutor(max_workers=workers) as pool:
        for start in range(0, len(todo), batch):
            chunk = todo[start:start + batch]
            for game_id, result in zip(chunk, pool.map(fetcher.game, chunk)):
                # A failed refresh keeps the data already stored.
                if result is not None or games.get(game_id) is None:
                    games[game_id] = result
                fetched += result is not None
            write()
    if not todo:
        write()
    nulls = sum(games.get(g) is None for g in game_ids)
    return fetched, skipped, nulls


def main(argv=None, fetch=http_fetch, sleep=time.sleep, batch=BATCH):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="archive root (default data/history)")
    parser.add_argument("--season", type=int, help="only this NHL season ID, e.g. 20232024")
    parser.add_argument("--refresh", action="store_true", help="refetch games that are already stored")
    args = parser.parse_args(argv)
    sources = sorted((args.root / "seasons").glob("*-[23].json.gz"))
    if args.season is not None:
        sources = [s for s in sources if s.name.startswith(f"{args.season}-")]
    (args.root / "dressed").mkdir(parents=True, exist_ok=True)
    fetcher = Fetcher(fetch, sleep)
    totals = [0, 0, 0]
    for source in sources:
        counts = run_season(source, args.root / "dressed" / source.name, fetcher, args.refresh, batch)
        totals = [a + b for a, b in zip(totals, counts)]
        print(f"{source.name.split('.')[0]}  fetched {counts[0]}, skipped {counts[1]}, null {counts[2]}", flush=True)
    print(f"total  fetched {totals[0]}, skipped {totals[1]}, null {totals[2]}")


if __name__ == "__main__":
    main()
