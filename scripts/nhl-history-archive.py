"""Write and fetch the manifest of completed-season NHL history archives."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

RELEASE = "nhl-history-archive"
KINDS = ("seasons", "dressed")
NAME = re.compile(r"^(\d+)-(\d+)\.json\.gz$")


class ArchiveError(Exception):
    pass


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(root):
    root = Path(root)
    found = []
    for kind in KINDS:
        directory = root / kind
        if not directory.is_dir():
            continue
        for path in directory.iterdir():
            match = NAME.match(path.name)
            if match:
                found.append((int(match.group(1)), kind, path))
    latest = sorted({season for season, _, _ in found})[-2:]
    files = []
    for season, kind, path in sorted(found, key=lambda f: (f[0], f[1], f[2].name)):
        if season in latest:
            continue
        files.append({
            "asset": f"{kind}-{path.name}",
            "path": f"{kind}/{path.name}",
            "bytes": path.stat().st_size,
            "sha256": sha256_of(path),
        })
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
    for entry in payload["files"]:
        target = root / entry["path"]
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
        temporary = target.with_name(target.name + ".part")
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
