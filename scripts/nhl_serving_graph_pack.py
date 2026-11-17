"""Serving step 2 of 2: pack `spans` into the C-graph blobs.

Writes `graph_arrays(name PRIMARY KEY, bytes BLOB)` (B6 adds its opponent blobs to
the same table), fills `players.teammates` (distinct linked players, every span
kind counted), then drops `spans` so the scratch table never ships.

All blobs are little-endian; big-endian hosts byte-swap explicitly.
"""
from array import array
import sys

MAX_PLAYERS = 65535   # edge_a / edge_b are Uint16
MAX_SEASONS = 255     # span_season is Uint8
MAX_TEAMS = 255       # span_team is Uint8
MAX_GAMES = 65535     # span_games is Uint16


def _code(*candidates, size):
    for c in candidates:
        if array(c).itemsize == size:
            return c
    raise RuntimeError(f"no array typecode of {size} bytes")  # defect: unsupported platform


U8, U16 = "B", _code("H", size=2)
U32 = _code("I", "L", size=4)


def pack(code, values):
    arr = array(code, values)
    if sys.byteorder == "big":
        arr.byteswap()
    return arr.tobytes()


def run(base, out):
    players = [p for (p,) in out.execute("SELECT player_id FROM players ORDER BY player_id")]
    seasons = [s for (s,) in out.execute("SELECT DISTINCT season_id FROM games ORDER BY season_id")]
    teams = [t for (t,) in out.execute("SELECT team_id FROM teams ORDER BY team_id")]
    if len(players) > MAX_PLAYERS:
        raise ValueError(f"{len(players)} players exceed the Uint16 limit of {MAX_PLAYERS}")
    if len(teams) > MAX_TEAMS:
        raise ValueError(f"{len(teams)} teams exceed the Uint8 limit of {MAX_TEAMS}")
    if len(seasons) > MAX_SEASONS:
        raise ValueError(f"{len(seasons)} seasons exceed the Uint8 limit of {MAX_SEASONS}")
    pid = {p: i for i, p in enumerate(players)}
    sid = {s: i for i, s in enumerate(seasons)}
    tid = {t: i for i, t in enumerate(teams)}

    edge_a, edge_b, span_start = [], [], []
    season, kind, team, link, games, first = [], [], [], [], [], []
    degree = [0] * len(players)
    previous = None
    # Raw IDs sort the same as indexes, so SQL order is the contract order.
    for a, b, s, k, t, lk, g, f in out.execute("""
            SELECT a, b, season_id, game_type, team_id, link, games, first_game_id
            FROM spans ORDER BY a, b, season_id, game_type, team_id, link"""):
        if g > MAX_GAMES:
            raise ValueError(f"span {a}-{b} has {g} games, over the Uint16 limit of {MAX_GAMES}")
        if (a, b) != previous:
            previous = (a, b)
            ia, ib = pid[a], pid[b]
            edge_a.append(ia)
            edge_b.append(ib)
            span_start.append(len(season))
            degree[ia] += 1
            degree[ib] += 1
        season.append(sid[s])
        kind.append(k)
        team.append(tid[t])
        link.append(lk)
        games.append(g)
        first.append(f)
    span_start.append(len(season))

    blobs = [
        ("player_ids", pack(U32, players)), ("season_ids", pack(U32, seasons)),
        ("team_ids", pack(U32, teams)),
        ("edge_a", pack(U16, edge_a)), ("edge_b", pack(U16, edge_b)),
        ("span_start", pack(U32, span_start)),
        ("span_season", pack(U8, season)), ("span_kind", pack(U8, kind)),
        ("span_team", pack(U8, team)), ("span_link", pack(U8, link)),
        ("span_games", pack(U16, games)), ("span_first_game", pack(U32, first)),
    ]
    out.execute("CREATE TABLE graph_arrays (name TEXT PRIMARY KEY, bytes BLOB NOT NULL)")
    out.executemany("INSERT INTO graph_arrays VALUES(?,?)", sorted(blobs))
    out.executemany("UPDATE players SET teammates = ? WHERE player_id = ?",
                    [(d, p) for p, d in zip(players, degree)])
    out.execute("DROP TABLE spans")
