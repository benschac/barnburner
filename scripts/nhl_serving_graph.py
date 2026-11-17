"""Serving step 1 of 2: shared-game spans (plan C-graph, "Define a teammate once").

Creates the scratch table `spans`, which the pack step (`nhl_serving_graph_pack`)
turns into the graph blobs and drops. Task B5 inserts goalie-partner rows
(`link` 1) between the two steps.

spans(a, b, season_id, game_type, team_id, link, games, first_game_id)
  a < b are player IDs. A span is one pair in one season, game type and team.
  `link` is 0 here: both players were credited in the same game for the same team.
"""

SCHEMA = """
CREATE TABLE spans (
    a INTEGER NOT NULL, b INTEGER NOT NULL, season_id INTEGER NOT NULL,
    game_type INTEGER NOT NULL, team_id INTEGER NOT NULL, link INTEGER NOT NULL,
    games INTEGER NOT NULL, first_game_id INTEGER NOT NULL,
    CHECK (a < b AND link IN (0, 1)),
    UNIQUE (a, b, season_id, game_type, team_id, link)
);
"""


def run(base, out):
    out.executescript(SCHEMA)
    # The serving appearances table is keyed by player, so pairing within a game
    # side needs its own key order. This scratch copy is temporary and never ships.
    out.executescript("""
        CREATE TEMP TABLE sides (
            season_id INTEGER, game_type INTEGER, team_id INTEGER, game_id INTEGER,
            player_id INTEGER,
            PRIMARY KEY (season_id, game_type, team_id, game_id, player_id)
        ) WITHOUT ROWID;
        INSERT INTO sides
            SELECT g.season_id, g.game_type, p.team_id, p.game_id, p.player_id
            FROM appearances p JOIN games g ON g.game_id = p.game_id;
    """)
    # One statement per (season, game type, team) keeps each GROUP BY small, so the
    # pairing stays in SQL without sorting every pair of the whole archive at once.
    groups = out.execute(
        "SELECT DISTINCT season_id, game_type, team_id FROM sides "
        "ORDER BY season_id, game_type, team_id").fetchall()
    for season, kind, team in groups:
        out.execute("""
            INSERT INTO spans
            SELECT x.player_id, y.player_id, x.season_id, x.game_type, x.team_id, 0,
                   COUNT(*), MIN(x.game_id)
            FROM sides x JOIN sides y
              ON y.season_id = x.season_id AND y.game_type = x.game_type
             AND y.team_id = x.team_id AND y.game_id = x.game_id
             AND y.player_id > x.player_id
            WHERE x.season_id = ? AND x.game_type = ? AND x.team_id = ?
            GROUP BY x.player_id, y.player_id""", (season, kind, team))
    out.execute("DROP TABLE sides")
