"""Serving step: flag Stanley Cup Final games (plan D8, C-serve).

Per season from FIRST_SEASON on, the Final is the highest playoff round from 1
to 8 present in `games`; every playoff game in that round is flagged. The
suspended game SUSPENDED_FINAL (round digit 9) is flagged as a Final of
SUSPENDED_SEASON. Each flagged game must have exactly two teams in the base
`game_sides` table (one row per team per game), otherwise the build fails.
"""

FIRST_SEASON = 19261927
SUSPENDED_FINAL = 1987030999
SUSPENDED_SEASON = 19871988


def run(base, out):
    rounds = out.execute("""
        SELECT game_id, season_id, playoff_round FROM games
        WHERE game_type = 3 AND playoff_round BETWEEN 1 AND 8 AND season_id >= ?
        ORDER BY game_id""", (FIRST_SEASON,)).fetchall()
    highest = {}
    for _, season, rnd in rounds:
        highest[season] = max(highest.get(season, 0), rnd)
    finals = {game for game, season, rnd in rounds if rnd == highest[season]}
    if out.execute("SELECT 1 FROM games WHERE game_id = ? AND season_id = ?",
                   (SUSPENDED_FINAL, SUSPENDED_SEASON)).fetchone():
        finals.add(SUSPENDED_FINAL)

    # Team count comes from base game_sides (one row per team per game).
    for game in sorted(finals):
        teams = base.execute(
            "SELECT COUNT(DISTINCT team_id) FROM game_sides WHERE game_id = ?", (game,)).fetchone()[0]
        if teams != 2:
            raise ValueError(f"Cup Final game {game} has {teams} teams, expected 2")

    out.executemany("UPDATE games SET cup_final = 1 WHERE game_id = ?",
                    [(game,) for game in sorted(finals)])
