"""Serving step: flag Stanley Cup Final games (plan D8, C-serve).

Per season from FIRST_SEASON on, the Final is the highest playoff round from 1
to 8 present in `games`; every playoff game in that round is flagged. The
suspended game SUSPENDED_FINAL (round digit 9) is flagged as a Final of
SUSPENDED_SEASON. Each flagged game must have exactly two teams in the base
`game_sides` table (one row per team per game), and the union of team IDs across
all of a season's flagged games must be exactly two, otherwise the build fails.

The most recent season with playoff games may still be in progress, so its highest
round present need not be the Final. That season is flagged only when its highest
round equals the Final round number of the previous season that had playoffs;
otherwise nothing is flagged for it. Older seasons keep the highest-round rule.
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
    if highest:
        latest = max(highest)
        earlier = [season for season in highest if season < latest]
        if earlier and highest[latest] != highest[max(earlier)]:
            finals -= {game for game, season, _ in rounds if season == latest}
    if out.execute("SELECT 1 FROM games WHERE game_id = ? AND season_id = ?",
                   (SUSPENDED_FINAL, SUSPENDED_SEASON)).fetchone():
        finals.add(SUSPENDED_FINAL)

    # Team count comes from base game_sides (one row per team per game).
    season_of = {game: season for game, season, _ in rounds}
    season_of[SUSPENDED_FINAL] = SUSPENDED_SEASON
    season_teams = {}
    for game in sorted(finals):
        teams = {t for (t,) in base.execute(
            "SELECT DISTINCT team_id FROM game_sides WHERE game_id = ?", (game,))}
        if len(teams) != 2:
            raise ValueError(f"Cup Final game {game} has {len(teams)} teams, expected 2")
        season_teams.setdefault(season_of[game], set()).update(teams)
    for season, teams in sorted(season_teams.items()):
        if len(teams) != 2:
            raise ValueError(f"Cup Final season {season} has {len(teams)} distinct teams, expected 2")

    out.executemany("UPDATE games SET cup_final = 1 WHERE game_id = ?",
                    [(game,) for game in sorted(finals)])
