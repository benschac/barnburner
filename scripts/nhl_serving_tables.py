"""Serving step: meta, players, teams, games, appearances, stints (plan C-serve)."""
import hashlib
import unicodedata

SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE players (
    player_id INTEGER PRIMARY KEY, name TEXT NOT NULL, search_name TEXT NOT NULL,
    position TEXT NOT NULL, first_season INTEGER NOT NULL, last_season INTEGER NOT NULL,
    games INTEGER NOT NULL, points INTEGER NOT NULL, teammates INTEGER NOT NULL
);
CREATE TABLE teams (team_id INTEGER PRIMARY KEY, abbrev TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE games (
    game_id INTEGER PRIMARY KEY, season_id INTEGER NOT NULL, game_type INTEGER NOT NULL,
    game_date TEXT NOT NULL, playoff_round INTEGER, cup_final INTEGER NOT NULL
);
CREATE TABLE appearances (
    player_id INTEGER, game_id INTEGER, team_id INTEGER NOT NULL,
    PRIMARY KEY(player_id, game_id)
) WITHOUT ROWID;
CREATE TABLE stints (
    player_id INTEGER, season_id INTEGER, game_type INTEGER, team_id INTEGER,
    games INTEGER NOT NULL, first_game_id INTEGER NOT NULL, last_game_id INTEGER NOT NULL,
    PRIMARY KEY(player_id, season_id, game_type, team_id)
) WITHOUT ROWID;
CREATE INDEX stints_by_team ON stints(team_id, season_id, game_type);
"""

POSITIONS = ("C", "L", "R", "D", "G")


def fold(name):
    """Lower case with accents folded (NFKD, combining marks dropped)."""
    decomposed = unicodedata.normalize("NFKD", name)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower()


def snapshot_id(base):
    hashes = sorted(h for (h,) in base.execute("SELECT sha256 FROM partitions"))
    return hashlib.sha256("".join(hashes).encode()).hexdigest()[:12]


def run(base, out):
    out.executescript(SCHEMA)
    latest = base.execute("SELECT MAX(game_date) FROM game_sides").fetchone()[0]
    out.executemany("INSERT INTO meta VALUES(?,?)", sorted([
        ("schema_version", "1"), ("snapshot_id", snapshot_id(base)),
        ("latest_game_date", latest or ""), ("cup_final_first_season", "19261927")]))

    # Latest abbreviation and name per team ID.
    out.executemany("INSERT INTO teams VALUES(?,?,?)", base.execute("""
        SELECT team_id, team, team_name FROM game_sides s
        WHERE game_id = (SELECT MAX(game_id) FROM game_sides WHERE team_id = s.team_id)
        ORDER BY team_id"""))

    out.executemany("INSERT INTO games VALUES(?,?,?,?,?,0)", base.execute("""
        SELECT game_id, MIN(season_id), MIN(game_type), MIN(game_date),
               CASE WHEN MIN(game_type) = 3 THEN (game_id / 100) % 10 END
        FROM game_sides GROUP BY game_id ORDER BY game_id"""))

    out.executemany("INSERT INTO appearances VALUES(?,?,?)", base.execute("""
        SELECT DISTINCT player_id, game_id, team_id FROM appearances
        ORDER BY player_id, game_id"""))

    out.executemany("INSERT INTO stints VALUES(?,?,?,?,?,?,?)", base.execute("""
        SELECT player_id, season_id, game_type, team_id, COUNT(DISTINCT game_id),
               MIN(game_id), MAX(game_id)
        FROM appearances GROUP BY player_id, season_id, game_type, team_id
        ORDER BY player_id, season_id, game_type, team_id"""))

    # Position ties break alphabetically (the first letter in sorted order).
    counts = {}
    for player, position, n in base.execute(
            "SELECT player_id, position, COUNT(*) FROM appearances GROUP BY 1, 2"):
        if position in POSITIONS:
            counts.setdefault(player, {})[position] = n
    rows = []
    for player, name, first, last, games, points in base.execute("""
            SELECT player_id,
                   (SELECT name FROM appearances a WHERE a.player_id = p.player_id
                    ORDER BY game_id DESC LIMIT 1),
                   MIN(season_id), MAX(season_id), COUNT(DISTINCT game_id), SUM(COALESCE(points, 0))
            FROM appearances p GROUP BY player_id ORDER BY player_id"""):
        by = counts.get(player, {})
        position = min(by, key=lambda p: (-by[p], p)) if by else ""
        rows.append((player, name, fold(name), position, first, last, games, points, 0))
    out.executemany("INSERT INTO players VALUES(?,?,?,?,?,?,?,?,?)", rows)
