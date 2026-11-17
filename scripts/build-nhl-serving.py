"""Build the serving database from the base database (plan C-serve).

Step interface: each name in STEPS is a module in scripts/ exposing
`run(base, out)`, where `base` is a read-only sqlite3 connection to the base
database and `out` is a writable connection to the temporary output. Steps run
in order and must insert in sorted order so the output is deterministic.
Later tasks add one name per step to STEPS.
"""
import argparse
import importlib
import os
from pathlib import Path
import sqlite3
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))

STEPS = [
    "nhl_serving_tables",
    "nhl_serving_finals",
    "nhl_serving_graph",
    "nhl_serving_partners",
    "nhl_serving_graph_pack",
    "nhl_serving_opponents",
]


def build(base_path, out_path):
    out_path = Path(out_path)
    same = out_path.resolve() == Path(base_path).resolve()
    if same or (out_path.exists() and os.path.samefile(base_path, out_path)):
        raise ValueError(f"--out {out_path} is the same file as --base")
    base = sqlite3.connect(Path(base_path).resolve().as_uri() + "?mode=ro", uri=True)
    base.isolation_level = None
    fd, temp = tempfile.mkstemp(suffix=".sqlite", dir=out_path.parent)
    os.close(fd)
    try:
        out = sqlite3.connect(temp)
        # One read transaction for the whole build: the snapshot ID names the data served.
        base.execute("BEGIN")
        base.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()  # take the snapshot now
        for name in STEPS:
            importlib.import_module(name).run(base, out)
            out.commit()
        base.execute("COMMIT")
        out.execute("VACUUM")
        out.close()
        base.close()
        os.replace(temp, out_path)
    except BaseException:
        base.close()
        if os.path.exists(temp):
            os.unlink(temp)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    build(args.base, args.out)
