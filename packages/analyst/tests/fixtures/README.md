# Analyst test fixtures

Trimmed copies of the real 2026-27 snapshot files, limited to NJD (New Jersey Devils) and WSH (Washington Capitals). Values are real; only games, teams, and standings rows were filtered. Same relative paths as `data/` at the repo root.

## Files

- `data/nhl-20262027.json`: 4 games, `sources` and `teams` filtered to the two clubs.
- `data/nhl-poster-20262027.json`: `completedGameIds` limited to the 3 final games; `standings` and `clubs` limited to the two clubs; `history` has 3 dates (2026-10-17, 2026-11-12, 2026-11-14), each with both clubs.
- `data/teams.json`: NJD and WSH, both Eastern / Metropolitan.
- `data/boxscores/20262027/2026020303.json` and `2026020318.json`: full real box scores.

## Games

| id | date | away @ home | result | archived box score |
| --- | --- | --- | --- | --- |
| 2026020121 | 2026-10-17 | NJD @ WSH | WSH 4, NJD 2 (REG) | no (final, missing on purpose) |
| 2026020303 | 2026-11-12 | WSH @ NJD | NJD 5, WSH 2 (REG) | yes |
| 2026020318 | 2026-11-14 | NJD @ WSH | NJD 7, WSH 4 (REG) | yes |
| 2026020828 | 2027-01-24 | WSH @ NJD | scheduled (state FUT, result null) | n/a |

## Hand-computed totals (3 final games only)

| team | W | L | OTL | GF | GA |
| --- | --- | --- | --- | --- | --- |
| NJD | 2 | 1 | 0 | 14 | 10 |
| WSH | 1 | 2 | 0 | 10 | 14 |

Derivation: NJD scored 2 + 5 + 7 = 14 and allowed 4 + 2 + 4 = 10. WSH scored 4 + 2 + 4 = 10 and allowed 2 + 5 + 7 = 14.

## Hand-computed box score totals

Game 2026020303 (2026-11-12, NJD 5 - WSH 2):
- Skaters: 18 per team (12 F, 6 D), 36 total. Skater goals match team scores (NJD 5, WSH 2), total goals 7.
- Shots on goal: NJD 29, WSH 28.
- Goalies:
  - C. Hellebuyck (NJD, starter, W): SA 28, saves 26, GA 2.
  - J. Allen (NJD): SA 0, saves 0, GA 0.
  - L. Thompson (WSH, starter, L): SA 28, saves 24, GA 4.
  - C. Lindgren (WSH): SA 0, saves 0, GA 0.

Game 2026020318 (2026-11-14, NJD 7 - WSH 4):
- Skaters: 18 per team (12 F, 6 D), 36 total. Skater goals match team scores (NJD 7, WSH 4), total goals 11.
- Shots on goal: NJD 33, WSH 47.
- Goalies:
  - C. Hellebuyck (NJD, starter, W): SA 47, saves 43, GA 4.
  - J. Allen (NJD): SA 0, saves 0, GA 0.
  - C. Lindgren (WSH, starter, L): SA 32, saves 26, GA 6.
  - L. Thompson (WSH): SA 0, saves 0, GA 0.

## Known quirks (do not "fix" in tests)

- Team shots on goal exceed the opposing goalies' shots against by 1 in both games (NJD 29 vs 28; NJD 33 vs 32).
- Goalie GA is 1 below the opposing score in both games (5 vs 4; 7 vs 6). Likely empty-net goals, which are not charged to a goalie. Not verified: there is no event data.
- Standings, clubs, and history values come from the full real file, not from these 3 games.

## Tests

`tests/fixtures.test.ts` parses every JSON file under `tests/fixtures/data`.
