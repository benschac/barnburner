"""Serving step: goalie-partner spans (plan D2, C-dressed).

Pairs two goalies on the same game side when both are in serving `players` and
they are not both credited in that game, then adds one `link` 1 row per
(a, b, season, game type, team) to the scratch `spans` table. It also copies the
dressed rows of known goalies into the serving table `dressed_goalies`. Without a
base `dressed_goalies` table the step does nothing.
"""


def run(base, out):
    has_table = base.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='dressed_goalies'").fetchone()
    if not has_table:
        return
    out.execute("""
        CREATE TABLE dressed_goalies (
            game_id INTEGER NOT NULL, team_id INTEGER NOT NULL, player_id INTEGER NOT NULL,
            PRIMARY KEY (game_id, team_id, player_id)
        ) WITHOUT ROWID""")
    known = {p for (p,) in out.execute("SELECT player_id FROM players")}
    rows = sorted((g, t, p) for g, t, p in base.execute(
        "SELECT DISTINCT game_id, team_id, player_id FROM dressed_goalies") if p in known)
    out.executemany("INSERT INTO dressed_goalies VALUES(?,?,?)", rows)
    out.execute("""
        INSERT INTO spans
        SELECT x.player_id, y.player_id, g.season_id, g.game_type, x.team_id, 1,
               COUNT(*), MIN(x.game_id)
        FROM dressed_goalies x
        JOIN dressed_goalies y
          ON y.game_id = x.game_id AND y.team_id = x.team_id AND y.player_id > x.player_id
        JOIN games g ON g.game_id = x.game_id
        WHERE NOT (
            EXISTS (SELECT 1 FROM appearances c WHERE c.player_id = x.player_id
                    AND c.game_id = x.game_id AND c.team_id = x.team_id)
            AND EXISTS (SELECT 1 FROM appearances c WHERE c.player_id = y.player_id
                    AND c.game_id = y.game_id AND c.team_id = y.team_id))
        GROUP BY x.player_id, y.player_id, g.season_id, g.game_type, x.team_id
        ORDER BY x.player_id, y.player_id, g.season_id, g.game_type, x.team_id""")
