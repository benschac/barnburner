# NHL season snapshot

`nhl-20262027.json` stores the 2026–27 regular-season schedule and available final results for all 32 NHL teams. Each NHL game ID occurs once, with home and away teams in the same record. Preseason and playoff games are excluded. The current season has 84 games per team, so a complete snapshot contains 1,344 games.

The source is the NHL's public [club season schedule feed](https://api-web.nhle.com/v1/club-schedule-season/NJD/20262027). The snapshot records all 32 source URLs and the retrieval timestamp. `teams.json` contains team names, abbreviations, divisions, and conferences from [NHL standings on November 9, 2026](https://api-web.nhle.com/v1/standings/2026-11-09).

From the repository root, refresh explicitly with Node.js 22 or newer:

```sh
npm run data:refresh
```

The refresh validates all 32 schedules, requires 84 unique regular-season games per team, checks both clubs report each game identically, and replaces the JSON file atomically. A failed or inconsistent fetch leaves the previous snapshot intact. A live game can change between club requests, which makes conflicting copies fail validation. Rerun after the source settles. Only `OFF` and `FINAL` games have a `result`; live and future scores do not become final results.

To import an existing download, place each club response in `DIR/TEAM.json`, such as `DIR/NJD.json`. Supply the actual retrieval timestamp:

```sh
npm run data:refresh -- --from-dir DIR --fetched-at 2026-11-09T12:00:00.000Z
```

The importer targets 2026–27 explicitly. A different season requires reviewing its team registry, game count, and schema assumptions.

Start the local read-only API:

```sh
npm run data:serve
curl 'http://127.0.0.1:3001/api/games?team=NJD'
curl 'http://127.0.0.1:3001/api/teams'
```

`GET /api/games` returns all games. The optional `team` parameter accepts one uppercase abbreviation from `/api/teams`. Unknown teams, duplicate parameters, and unsupported parameters return HTTP 400. Responses include `season` and `fetchedAt`. The server reads the snapshot once at startup and makes no NHL requests. Restart it after refreshing the snapshot. Optional `--host`, `--port`, and `--snapshot` arguments configure its listener and input file. The default listener is local to this machine.

Consumers can also import `selectTeamGames(snapshot, team)` from `lib/nhl-games.mjs` and use the same filter without running a server. The records keep canonical home and away scores; a client can derive goals for and against from its selected team.

This adds the game-data foundation. The existing Devils poster remains on its original snapshot. Player leaders, special teams, standings, and historical playoff comparisons require additional feeds before the complete poster can switch teams. No database, refresh scheduler, or production deployment is configured.

Run `npm run test:data` to verify normalization, coverage, filtering, failed-write preservation, and HTTP behavior.
