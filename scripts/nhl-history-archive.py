"""Write and fetch the manifest of completed-season NHL history archives."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import urllib.parse
import urllib.request

RELEASE = "nhl-history-archive"
KINDS = ("seasons", "dressed")
GAME_TYPES = (2, 3)
ENTRY_PATH = re.compile(r"^(seasons|dressed)/\d{8}-[23]\.json\.gz$")


class ArchiveError(Exception):
    pass


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def catalog_seasons(root):
    path = root / "seasons.json"
    if not path.is_file():
        raise ArchiveError(f"season catalog is missing: {path}")
    try:
        rows = json.loads(path.read_text())["data"]
        seasons = sorted({int(row["id"]) for row in rows})
    except (ValueError, KeyError, TypeError) as error:
        raise ArchiveError(f"season catalog is unreadable: {path}: {error}") from error
    if len(seasons) < 3:
        raise ArchiveError(f"season catalog lists too few seasons: {path}")
    return seasons


def null_games(path):
    try:
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            games = json.load(handle)["games"]
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise ArchiveError(f"unreadable dressed file {path}: {error}") from error
    return sorted(str(game) for game, value in games.items() if value is None)


def build_manifest(root):
    root = Path(root)
    eligible = catalog_seasons(root)[:-2]
    missing, pending, files = [], [], []
    for season in eligible:
        for kind in sorted(KINDS):
            for game_type in GAME_TYPES:
                name = f"{season}-{game_type}.json.gz"
                path = root / kind / name
                if not path.is_file():
                    missing.append(f"{kind}/{name}")
                    continue
                if kind == "dressed":
                    pending += [f"dressed/{name}: {game}" for game in null_games(path)]
                files.append({
                    "asset": f"{kind}-{name}",
                    "path": f"{kind}/{name}",
                    "bytes": path.stat().st_size,
                    "sha256": sha256_of(path),
                })
    if missing:
        raise ArchiveError("incomplete inventory, missing: " + ", ".join(missing))
    if pending:
        raise ArchiveError("dressed backfill unfinished, null games: " + ", ".join(pending))
    return {"release": RELEASE, "files": files}


def manifest(args):
    root = Path(args.root)
    payload = build_manifest(root)
    root.mkdir(parents=True, exist_ok=True)
    (root / "manifest.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    if args.files:
        for entry in payload["files"]:
            print(root / entry["path"])
    else:
        print(f"{len(payload['files'])} files listed in {root / 'manifest.json'}")


def download(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def checked_target(root, resolved_root, entry):
    relative = entry.get("path") if isinstance(entry, dict) else None
    if not isinstance(relative, str) or not ENTRY_PATH.match(relative):
        raise ArchiveError(f"invalid manifest path: {relative!r}")
    target = root / relative
    if not target.resolve().is_relative_to(resolved_root):
        raise ArchiveError(f"manifest path escapes the root: {relative}")
    return target


def fetch(args):
    root = Path(args.root)
    payload = json.loads((root / "manifest.json").read_text())
    base = args.base_url
    if not base:
        repo = args.repo or os.environ.get("GITHUB_REPOSITORY")
        if not repo:
            raise ArchiveError("pass --base-url, --repo, or set GITHUB_REPOSITORY")
        base = f"https://github.com/{repo}/releases/download/{payload.get('release', RELEASE)}/"
    if not base.endswith("/"):
        base += "/"
    fetched = skipped = 0
    resolved_root = root.resolve()
    for entry in payload["files"]:
        target = checked_target(root, resolved_root, entry)
        if target.is_file() and target.stat().st_size == entry["bytes"] \
                and sha256_of(target) == entry["sha256"]:
            skipped += 1
            continue
        url = base + urllib.parse.quote(entry["asset"])
        try:
            data = download(url)
        except OSError as error:
            raise ArchiveError(f"download failed for {entry['asset']}: {error}") from error
        if len(data) != entry["bytes"]:
            raise ArchiveError(
                f"{entry['asset']}: expected {entry['bytes']} bytes, got {len(data)}")
        actual = hashlib.sha256(data).hexdigest()
        if actual != entry["sha256"]:
            raise ArchiveError(
                f"{entry['asset']}: expected sha256 {entry['sha256']}, got {actual}")
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
                dir=target.parent, prefix=target.name + ".", suffix=".part", delete=False) as handle:
            temporary = Path(handle.name)
        try:
            temporary.write_bytes(data)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        fetched += 1
    print(f"fetched {fetched}, skipped {skipped}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    one = sub.add_parser("manifest")
    one.add_argument("--root", default="data/history")
    one.add_argument("--files", action="store_true", help="print local paths to upload")
    one.set_defaults(run=manifest)
    two = sub.add_parser("fetch")
    two.add_argument("--root", default="data/history")
    two.add_argument("--base-url")
    two.add_argument("--repo")
    two.set_defaults(run=fetch)
    args = parser.parse_args(argv)
    try:
        args.run(args)
    except ArchiveError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
