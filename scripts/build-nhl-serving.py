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
    "nhl_serving_graph_pack",
    "nhl_serving_opponents",
]


def build(base_path, out_path):
    base = sqlite3.connect(f"file:{Path(base_path).resolve()}?mode=ro", uri=True)
    out_path = Path(out_path)
    fd, temp = tempfile.mkstemp(suffix=".sqlite", dir=out_path.parent)
    os.close(fd)
    try:
        out = sqlite3.connect(temp)
        for name in STEPS:
            importlib.import_module(name).run(base, out)
            out.commit()
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
