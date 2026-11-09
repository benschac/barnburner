# NHL season snapshot

`nhl-20262027.json` stores the 2026–27 regular-season schedule and available final results for all 32 NHL teams. Each NHL game ID occurs once, with home and away teams in the same record. Preseason and playoff games are excluded. The current season has 84 games per team, so a complete snapshot contains 1,344 games.

The source is the NHL's public [club season schedule feed](https://api-web.nhle.com/v1/club-schedule-season/NJD/20262027). The snapshot records all 32 source URLs and the retrieval timestamp. `teams.json` contains team names, abbreviations, divisions, and conferences from [NHL standings on November 9, 2026](https://api-web.nhle.com/v1/standings/2026-11-09).

From the repository root, refresh explicitly with Node.js 22 or newer:

```sh
bun run data:refresh
```

The refresh validates all 32 schedules, requires 84 unique regular-season games per team, checks both clubs report each game identically, and replaces the JSON file atomically. A failed or inconsistent fetch leaves the previous snapshot intact. A live game can change between club requests, which makes conflicting copies fail validation. Rerun after the source settles. Only `OFF` and `FINAL` games have a `result`; live and future scores do not become final results.

To import an existing download, place each club response in `DIR/TEAM.json`, such as `DIR/NJD.json`. Supply the actual retrieval timestamp:

```sh
bun run data:refresh --from-dir DIR --fetched-at 2026-11-09T12:00:00.000Z
```

The importer targets 2026–27 explicitly. A different season requires reviewing its team registry, game count, and schema assumptions.

Start the local read-only API:

```sh
bun run data:serve
curl 'http://127.0.0.1:3001/api/games?team=NJD'
curl 'http://127.0.0.1:3001/api/teams'
```

`GET /api/games` returns all games. The optional `team` parameter accepts one uppercase abbreviation from `/api/teams`. Unknown teams, duplicate parameters, and unsupported parameters return HTTP 400. Responses include `season` and `fetchedAt`. The server reads the snapshot once at startup and makes no NHL requests. Restart it after refreshing the snapshot. Optional `--host`, `--port`, and `--snapshot` arguments configure its listener and input file. The default listener is local to this machine.

Consumers can also import `selectTeamGames(snapshot, team)` from `lib/nhl-games.mjs` and use the same filter without running a server. The records keep canonical home and away scores; a client can derive goals for and against from its selected team.

The web app calls the shared `GetTeamData` RPC at `/api/rpc` on team selection. It returns the validated season and poster together. All teams share the same poster, including New Jersey. The 32-team selector and poster team rows open shareable `#team/TEAM` links; `#poster` selects New Jersey. Failed requests show a retry action instead of displaying another team's data.

## Poster supplement

`nhl-poster-20262027.json` contains current standings, standings for completed game dates, special-team percentages and league ranks, and player leaders for all 32 clubs. Its sources are the NHL [standings](https://api-web.nhle.com/v1/standings/2026-11-08), [club stats](https://api-web.nhle.com/v1/club-stats/NJD/20262027/2), and [team summary](https://api.nhle.com/stats/rest/en/team/summary?limit=-1&cayenneExp=seasonId%3D20262027%20and%20gameTypeId%3D2) feeds. Player portraits remain NHL-hosted URLs.

Refresh games first, then the poster supplement:

```sh
bun run data:refresh
bun run data:refresh:poster
```

Restart `bun run data:serve` after refreshing. The server serves saved data without requesting NHL feeds. The supplement refresh checks coverage and consistency with the game snapshot before replacing its output. A failed refresh preserves the previous supplement. The two files are replaced separately, so complete both refreshes before restarting the API.

Vite proxies `/api` to `http://127.0.0.1:3001` in development and preview. On Vercel, the web project's API function hosts the same router with bundled snapshots. Publishing refreshed production data requires redeploying. No database or scheduled refresh is configured.

Run `bun run test:data` to verify normalization, coverage, filtering, failed-write preservation, and HTTP behavior.

Run `bun run test:api` to verify real Node HTTP RPC calls, typed failures, and cancellation. See [the server architecture](../apps/api/README.md) for the shared contract and Layer composition.
