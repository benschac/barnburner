"""Serving step: opponent arrays opp_a, opp_b, opp_games (plan C-graph, D14)."""
from array import array
import sys

LIMIT = 65535


def pack(typecode, values):
    arr = array(typecode, values)
    if sys.byteorder == "big":
        arr.byteswap()
    return arr.tobytes()


def run(base, out):
    out.execute("CREATE TABLE IF NOT EXISTS graph_arrays(name TEXT PRIMARY KEY, bytes BLOB)")
    ids = [r[0] for r in out.execute("SELECT player_id FROM players ORDER BY player_id")]
    if len(ids) > LIMIT:
        raise ValueError(f"{len(ids)} players exceed {LIMIT}")
    index = {p: i for i, p in enumerate(ids)}
    out.execute("CREATE INDEX IF NOT EXISTS opp_game_team ON appearances(game_id, team_id)")
    a, b, games = array("H"), array("H"), []
    rows = out.execute("""
        SELECT x.player_id, y.player_id, COUNT(*)
        FROM appearances x JOIN appearances y
          ON y.game_id = x.game_id AND y.team_id <> x.team_id AND x.player_id < y.player_id
        GROUP BY x.player_id, y.player_id ORDER BY x.player_id, y.player_id""")
    pairs = []
    for pa, pb, n in rows:
        if n > LIMIT:
            raise ValueError(f"opponent pair {pa}v{pb} has {n} games, over {LIMIT}")
        pairs.append((index[pa], index[pb], n))
    out.execute("DROP INDEX opp_game_team")
    pairs.sort()
    out.executemany("INSERT OR REPLACE INTO graph_arrays VALUES(?,?)", [
        ("opp_a", pack("H", (p[0] for p in pairs))),
        ("opp_b", pack("H", (p[1] for p in pairs))),
        ("opp_games", pack("H", (p[2] for p in pairs)))])
