# NHL teammate graph: implementation plan

Status: ready to start, Nov 17 2026. Owner: Ben.

Build a graph of everyone credited with playing in the NHL. A fan should be able to start at Connor McDavid, open one of his Edmonton rosters, follow a teammate to another club or era, and eventually reach Ted Lindsay. Every hop should answer “when did these two play together?” with a team and a specific game.

The import exists locally and reconciles. Everything else here is planned. This revision records the review of Nov 17: it fixes the engine choice, closes the holes the review found, adds goalie partners and “played against”, and splits the work into small PRs. Scope, agreed Nov 17: the data structure, the backend, and the core queries. The web explorer and the game come later (§Later). Nov 18: §Frontend adds the visualization decisions and a spike that the explorer's cards wait on.

## How to use this plan

- Each task card (§Task cards) is a complete prompt for one worker. §Worker preamble applies to every card.
- The work is one Graphite stack of small PRs. A task is **ready** when every ID on its **Needs** line is in the stack (verified and submitted). Nothing waits for a merge, and there are no waves: dispatch every ready task at once.
- §Contracts defines every shared shape. A task that needs only a contract can start before the code that produces the real data exists.
- Each card names the cheapest model and reasoning effort that fits it (§Model and effort tiers).
- Track progress in §Ledger.

## What we have

Measured on the archive fetched Nov 17 2026 (latest game Nov 16). This is the **baseline snapshot**.

| Artifact or measurement | Baseline |
| --- | --- |
| Source archive | 218 compressed files, about 121 MiB. One regular-season and one playoff file for each of 109 seasons, 1917–18 through the partial 2026–27. Untracked in git. |
| Coverage | 8,842 players. All 2,585,028 skater and goalie game credits reconcile to independent NHL season totals. 32 dual-role cases leave 2,584,996 distinct `(game, team, player)` appearances. |
| Base SQLite | 212 MiB at `data/history/nhl.sqlite`. A full offline build takes 74 s. |
| Teammate links | 478,383 undirected pairs. 1,049,918 spans, where a span is one pair in one season, competition, and team. 143,729 pairs share a playoff game. 39,899 pairs share exactly one game. |
| Goalie partners | The season reports list only goalies who played. The NHL box score also lists the dressed backup, with no ice time. Sampled games from 1975, 1985, 1996, 2005, 2015, and 2026 show one; a 1955 game shows one goalie a side, and so does one side of the 1975 game. Not imported yet: one request per game, 70,642 games (**I1**). For scale, 3,492 times two goalies were credited for the same club, season, and competition without sharing a game. |
| Played against | 3,273,864 pairs faced each other, across 10,225,824 pair-seasons. 810,839 pairs met once; the most is 266 games. 306,657 pairs were both teammates and opponents. Deriving them takes 34 s. |
| Graph shape | One connected component. Diameter 9, radius 5. Most teammates: Jaromír Jágr, 518. McDavid has 174. |
| Path search | The adjacency lists fit in 1.9 MB of typed arrays. A full breadth-first search from McDavid takes 1.3 ms in Node 24. All-pairs distances take 11 s. |
| Serving prototype | Players, games, appearances, and stints fit in a 45.6 MiB SQLite file (7.2 MiB gzipped) before the graph arrays. Listing all 879 McDavid–Draisaitl shared games takes 0.8 ms. A roster lookup takes 0.04 ms. |
| Player pool | 434 players appeared in one game. 3,923 (44%) played fewer than 82. 57 names are shared by 115 players. |

[Importer](../scripts/import-nhl-history.py) · [Database builder](../scripts/build-nhl-history.py) · [Independent checker](../scripts/check_nhl_history.py)

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | **SQLite plus an in-memory graph is the engine.** LadybugDB and Neo4j Aura are dropped, and so is the engine bake-off. | Every query the product needs runs in about a millisecond on arrays that fit in memory. A graph database adds a native dependency or a network hop and removes nothing. |
| D2 | **Three kinds of link.** _Played with_: both have a games-played credit for the same team in the same game. _Goalie partners_: both goalies are on the same team's box score for the same game and at least one has no credit in it, usually the dressed backup. _Played against_: credited on opposite sides of the same game. A chain uses the first two, so every teammate hop has a game behind it. | Ben's call, Nov 17: two goalies on the roster for a game have played together, and opponents should be shown too. Only players with at least one credited NHL game are in the graph, so an emergency backup who never played is not. |
| D14 | **Played against is its own relation and an optional path mode.** Its links carry a game count only. The default chain and the Finals question use teammates. | Opponents are seven times denser than teammates, which would make every route short. Per-season detail for 10.2 million opponent pair-seasons is about 80 MB; the shared games for one pair take under a millisecond to look up instead. |
| D3 | **Path search runs in the API function.** The graph is loaded once per warm function. The browser gets results, not the graph. | One implementation to test. Moving search to the browser later needs no contract change. |
| D4 | **One serving file.** `nhl-serve.sqlite` (about 80 MiB) holds the lookup tables and the graph arrays as blobs. The API reads it with the built-in `node:sqlite`, read-only. | One artifact to version, verify, and ship. No new dependency: `node:sqlite` loads in Node 24.18 and Bun 1.4.3. **V1** proves it inside the packaged Vercel function. |
| D5 | **The 212 MiB base database is build-time only.** It never ships. | The serving file carries everything a request needs. |
| D6 | **Shortest paths have a fixed order.** Compare two shortest paths hop by hop from the start: more games together first, then the lower player ID. Games as goalie partners count. “The” shortest path is the first in this order. | Without a rule, cached answers and tests flip between builds. Strong links are also the ones fans recognise. |
| D7 | **Three filters: competition, season range, and whether goalie partners count.** A link passes when at least one of its spans passes. The evidence for a hop always comes from a passing span. The filters apply to teammate paths only. | These are the filters the plan's questions need. Spans make them exact; a first-and-last-season summary would pass links with a gap in the middle. Turning partners off gives the strict “a game behind every hop” chain. |
| D8 | **Cup Final games are derived from the game ID.** Digit 8 of a playoff game ID is the round. The Final is the highest round from 1 to 8 in a season, plus the suspended game `1987030999`. Flag Finals only from 1926–27 on. | Checked: in all 107 playoff seasons the highest round is one series between two teams, and the rule reproduces the Jágr result. Before 1927 the Cup Final was played against other leagues and is not in NHL game data. |
| D9 | **Players get a table.** ID, name, an accent-folded search name, position, first and last season, games, and points. Search results show position, years, and clubs. | 57 names are shared by 115 players. Games and points also give puzzles a fame measure. The base build drops position and points today (**B1**). |
| D10 | **Every answer carries a snapshot ID.** It is the first 12 hex characters of the SHA-256 over the sorted partition hashes. | New games shorten distances. An answer must name the data it was computed on. |
| D11 | **Archives and the serving file live in GitHub Release assets. Git holds a manifest and a pointer.** A release is a tagged page on the repo with files attached; GitHub stores them outside git history and serves each at a fixed URL. The nightly job commits `data/history/serving.json`; the push triggers the deploy, as box-score refreshes do today. | The repo is public and about 3 MB. The archive is 121 MiB, and the current-season file (0.7–2.7 MB) is rewritten on every refresh. Approved Nov 17, including republishing the NHL reports. |
| D13 | **User state is out of scope.** No accounts, saved chains, or leaderboards. | If a later game needs them, add Postgres for that state only. The history data stays in SQLite. |

Not chosen:

- **LadybugDB.** Fine as a local tool for ad hoc Cypher research. Not part of the build or the service.
- **Neo4j Aura, Turso, Postgres for history data.** Each adds a server to a read-only dataset that is rebuilt from files.
- **Committing archives or the serving file to git.** A nightly binary of 7 MiB or more would grow the repo by gigabytes a season.

## Define a teammate once

Use NHL player IDs for identity. A player qualifies through a credited regular-season or playoff appearance, including a playoff-only career. Keep role credits as reported. For the graph, count each distinct `(game_id, team_id, player_id)` once. Two different players are teammates when they share a game and team, or when they are goalie partners (D2). They are opponents when they share a game on different teams. Store each pair once, lower player ID first.

| Case | Expected result |
| --- | --- |
| Midseason trade | Ryan Johansen and Seth Jones both played for Columbus and Nashville in 2015–16. They shared zero game sides that season. Each still connects to the teammates he actually played with. |
| Skater goes in goal | Ottawa's Sprague Cleghorn scored a goal and played three minutes in net on February 18, 1919. Preserve both role credits and count one shared game for each teammate. [NHL game record](https://www.nhl.com/gamecenter/1918020026) |
| Goalie partners | Adin Hill and Ilya Samsonov shared the Vegas net through 2024–25 and were never credited in the same game. Each dressed behind the other, so they should link through those games. Confirmed when **I1** has imported the box scores. |
| Goalie replaced | Bill Ranford's last game for the 1995–96 Oilers was January 3; Fred Brathwaite relieved him. Curtis Joseph's first was January 13, with Brathwaite dressed behind him. Ranford and Brathwaite both played on January 3, so they link through that game. Joseph and Brathwaite link as goalie partners. Ranford and Joseph were not on a roster together in either game, so they are two hops apart through Brathwaite. |
| One goalie dressed | Before the mid-1960s clubs dressed one goalie. Jacques Plante and Gerry McNeil of the 1953–54 Canadiens link only if a box score lists both. |
| Backup who never played | A dressed goalie with no credited NHL game is not a player in the graph. A dressed goalie links to the other goalie only, not to the skaters. |
| Teammates and opponents | A pair can be both. Each relation keeps its own games. |
| Forfeit or conflicting reports | Keep games with empty player lists, including the two 1917–18 Wanderers forfeits. Preserve source disagreements (41 on the baseline). For the suspended 1988 Final game `1987030999`, player reports supply the game sides. Leave unconfirmed home or road assignments unknown. |

## Questions the graph must answer

| Question | Rule and result |
| --- | --- |
| How do I get from McDavid to Lindsay? | Return the first shortest chain in D6 order, with an evidence game for each hop. Return further tied chains up to a limit, and the number of tied chains. The baseline distance is five. A valid six-hop chain is McDavid → Corey Perry → Chris Pronger → Brad McCrimmon → Mark Howe → Gordie Howe → Lindsay. |
| Who is farthest from this player? | One search from the player. Return the largest shortest distance, how many players sit at it, and one example chain. Count unreachable players separately; a filter can disconnect the graph. |
| Who did he play with, and when? | A player's clubs by season, each club's roster, and for any pair the games together by season and club. |
| Who did he play against? | A player's opponents, most games first. For a pair, the games on opposite sides, next to any games together. A path may use opponents when asked: “against only” or “either”. |
| In which Stanley Cup Finals did a Jágr teammate play? | Intersect a player's direct teammates with each Final's participants. Return, for each matching year, a player, a Final game, and a shared game. The teammate link may come before or after that Final. |

The Jágr result is an acceptance test. His 518 shared-game teammates cover **45 of the 46 Finals from 1980 through 2026**; the gap is 2022. Ondřej Palát extends the streak only if Czech national-team games count, which would need a separately sourced international dataset. The answer carries the competition rule. [NHL account of the streak](https://www.nhl.com/cs/news/jagrovi-spoluhraci-ve-finale-stanley-cupu)

## Orchestration

| Role | Who | Does |
| --- | --- | --- |
| Orchestrator | The main Claude Code session, on Opus at high effort | Owns §Ledger. Dispatches ready tasks, reruns each **Done** check, runs each **Gate** on the full snapshot, registers branches with Graphite, opens PRs. Builds **H0** itself, because the files it lands are untracked and absent from worktrees. |
| Claude workers | Subagents with `isolation: "worktree"` | Build one card each, at the card's model and effort. |
| Codex truth writer | `codex exec` in a worktree | Writes the reference answers (**T1**) from the base database with plain SQL and a dictionary search. A different model family and a different implementation keep the truth from sharing the service's mistakes. |
| Codex reviewer | `codex review` on each PR diff | Reviews every PR against its card and the contract sections it cites. Opus at high effort also reviews the five Sonnet · high PRs: **K1**, **B4**, **Q1**, **Q2**, and **Q7**. |

- **Orchestrator model:** Opus at high effort (Ben's call, Nov 17). The cards make dispatch mechanical, but a wrongly passed check or a bad rebase damages every PR above it. Extra-high effort is worth it only to diagnose a failed gate or to re-plan after **V1**.
- **Escalation:** if a task fails its Done check twice, raise the effort one step. If it fails again, move up one model. Note the change in §Ledger.
- Nothing in this plan calls a model at run time, so no task spends API money beyond its builder.

### Model and effort tiers

Pass both to the Agent tool: `model: 'sonnet', effort: 'medium'`.

| Tier | Use for | Tasks |
| --- | --- | --- |
| **Haiku · low** | Wiring that copies an existing file or an exact shape from this plan | O1 |
| **Haiku · medium** | Small pure functions whose tests are fully specified here | B3, A4 |
| **Sonnet · low** | Scaffolding and scripts that mirror a house example line for line | K0, C1 |
| **Sonnet · medium** | Normal implementation with tests: importers, SQL projections, Effect services, RPC handlers | I1, I2, B1, B2, B5, B6, O2, O3, O4, Q3, Q4, Q6, A1, A2a, A2b, A2c, A2d, A3, V1, T2 |
| **Sonnet · high** | Work where a subtly wrong answer passes a casual test: shared contracts, tie order, filtered evidence, array layout | K1, B4, Q1, Q2, Q7 |
| **Opus · high** | Second review of the five Sonnet · high PRs. No builder task. | — |
| **Codex** | Independent reference answers | T1 |

No builder task needs Opus or Fable. The decisions that would have needed them are made in this document.

### Worker preamble (prepended to every card)

1. Run `bun install` first. A fresh worktree has no `node_modules`.
2. Branch from the top of the stack (the orchestrator names it) as `history/<id>-<slug>`.
3. Write only the files on the **Write** list. If the task needs a change anywhere else, stop and report.
4. Read the card's **Read** list first. Do not explore the rest of the repo.
5. The NHL archive is not in your worktree, and you do not need it: every Done check uses small inline inputs. The orchestrator runs each **Gate (Archive)** on the full snapshot. Never copy or commit archive files.
6. A dependency that is not in the stack yet is a parameter, not an import. Use the types in `packages/history/src/shapes.ts` and the fakes in `packages/history/tests/fakes.ts`.
7. Commit when **Done** passes. Do not push. Report the Done output.
8. Follow AGENTS.md. For Effect APIs, copy the style of `packages/season/src/contracts.ts` and `apps/api/src/boxscores.ts`.

- **py-check** means, from the repo root: `bun run test:history`.
- **pkg-check** means, from `packages/history`: `bun run typecheck && bun run lint && bun run test`.
- **api-check** means, from `apps/api`: `bun run typecheck && bun run lint && bun run test`.

### Graphite

- **One linear `history/*` stack on `main`.** The type-aware lint setup the new TypeScript package needs merged to `main` on Nov 17. The stack sits beside the open `analyst/ai1`–`ai5` stack and shares no files with it.
- Workers branch from the current top. When several finish together, the orchestrator rebases them into a chain, reruns each Done check, and submits. A **Stack on** note only fixes the order of two tasks that touch the same file.
- **Merging** is bottom-up, whenever Ben chooses. It never blocks dispatch.
- **Shared files.** Each `package.json` is edited by one task: the root in **H0**, `packages/history` in **K0**, `apps/api` in **A3**. `turbo.json` changes only in **A4**.
- The stack has other writers. Fetch and check the reflog before rewriting it.
- After a worktree agent commits, register the branch with `gt track --parent <parent>`, then `gt submit --stack --force --no-edit --no-interactive --publish --branch <top>`, and set the title and body with `gh pr edit`. Do not open PRs with `gh pr create`.

## Contracts

### C-base: base database (exists)

`data/history/nhl.sqlite`, built by `scripts/build-nhl-history.py --root <archive> --db <file>`.

- `partitions(season_id, game_type, sha256, fetched_at, sources)`
- `game_sides(game_id, team_id, season_id, game_type, game_date, team, team_name, home_road, opponent_id, source)`
- `appearances(season_id, game_type, game_id, team_id, team, player_id, name, role)`. **B1** adds `position` and `points`.
- `source_disagreements(game_id, team_id, player_id, role, reported_side, reported_date)`
- `game_type` is 2 for the regular season and 3 for the playoffs. A game ID is `YYYYTTNNNN`: start year, type, number. For playoffs, `(game_id / 100) % 10` is the round.

### C-dressed: dressed goalies

`data/history/dressed/<season>-<type>.json.gz`, written by `scripts/import-nhl-dressed.py` from `https://api-web.nhle.com/v1/gamecenter/<gameId>/boxscore`.

- `{ seasonId, gameType, fetchedAt, games: { "<gameId>": { "<teamAbbrev>": [{ playerId, toi }] } } }`. `toi` is the string the NHL returns, or null.
- A game whose box score could not be fetched is `null`. An empty list means the box score listed no goalie. These are different.
- The base build loads it into `dressed_goalies(game_id, team_id, player_id)`, one row per listed goalie, whether or not he played (**I2**).

### C-serve: serving database

`nhl-serve.sqlite`, built by `scripts/build-nhl-serving.py --base <nhl.sqlite> --out <file>`. Two builds from the same base are byte-identical.

| Table | Columns | Notes |
| --- | --- | --- |
| `meta` | `key, value` | Keys: `schema_version` (`1`), `snapshot_id` (D10), `latest_game_date`, `cup_final_first_season` (`19261927`). No build time, so builds stay identical. |
| `players` | `player_id` PK, `name`, `search_name`, `position`, `first_season`, `last_season`, `games`, `points`, `teammates` | `search_name` is lower case with accents folded. `position` is the most frequent of `C, L, R, D, G`. `games` counts distinct games. `teammates` is the number of links. |
| `teams` | `team_id` PK, `abbrev`, `name` | One row per NHL team ID. `UTA` appears under two IDs; that is correct. |
| `games` | `game_id` PK, `season_id`, `game_type`, `game_date`, `playoff_round`, `cup_final` | `playoff_round` is null for the regular season. `cup_final` is 0 or 1 (D8), written by **B3**. |
| `appearances` | `player_id, game_id, team_id`; PK `(player_id, game_id)`; `WITHOUT ROWID` | One row per distinct appearance. |
| `stints` | `player_id, season_id, game_type, team_id, games, first_game_id, last_game_id`; PK in that column order through `team_id`; index on `(team_id, season_id, game_type)` | Drives player pages and rosters. |
| `graph_arrays` | `name` PK, `bytes` BLOB | §C-graph, written by **B4**. |

### C-graph: graph arrays

Little-endian typed arrays, one blob per name. `n` players, `m` links, `s` spans.

| Name | Type | Meaning |
| --- | --- | --- |
| `player_ids` | `Uint32[n]` | Ascending. A player's index is his position here. The build fails if `n` exceeds 65,535. |
| `season_ids` | `Uint32[S]` | Ascending. |
| `team_ids` | `Uint32[T]` | Ascending. The build fails if `T` exceeds 255. |
| `edge_a`, `edge_b` | `Uint16[m]` | Player indexes with `a < b`, sorted by `(a, b)`. |
| `span_start` | `Uint32[m + 1]` | Link `e` owns spans `span_start[e]` up to `span_start[e + 1]`. |
| `span_season`, `span_kind`, `span_team` | `Uint8[s]` | Season index, competition (2 or 3), team index. Spans of a link are sorted by these three. |
| `span_link` | `Uint8[s]` | 0 when both were credited, 1 for goalie partners. A link can hold both, in different spans. |
| `span_games` | `Uint16[s]` | Games together in the span. |
| `span_first_game` | `Uint32[s]` | Lowest game ID in the span. |
| `opp_a`, `opp_b` | `Uint16[o]` | Opponent pairs, same rules as `edge_a` and `edge_b`. Written by **B6**. |
| `opp_games` | `Uint16[o]` | Games on opposite sides. |

Baseline sizes: `n` 8,842; 478,383 shared-game links with 1,049,918 spans; `o` 3,273,864. About 14 MiB for teammates and 20 MiB for opponents. Goalie-partner counts are known once **I1** has run.

### C-mini: the shared test league

Every builder and search test uses these eight games. Players 11–20, teams 1–4. Players 16 and 17 are goalies; everyone else is a skater.

| Game | ID | Season | Kind | Side | Side |
| --- | --- | --- | --- | --- | --- |
| A | 1950020001 | 1950–51 | 2 | Team 1: 11, 12 | Team 3: 15, 16 |
| B | 1950020002 | 1950–51 | 2 | Team 1: 11, 12 | Team 3: 15, 16 |
| C | 1950020003 | 1950–51 | 2 | Team 1: 11, 13 | Team 4: 19, 20 |
| E | 1951020001 | 1951–52 | 2 | Team 2: 12, 14 | Team 3: 16 (17 dressed) |
| D | 1951020002 | 1951–52 | 2 | Team 2: 12, 14 | Team 3: 17, 18 (16 dressed) |
| F | 1951020003 | 1951–52 | 2 | Team 2: 13, 14 | Team 3: 16 (17 dressed) |
| G | 1951030111 | 1951–52 | 3 | Team 2: 14, 15 | Team 3: 16 |
| H | 1951030112 | 1951–52 | 3 | Team 2: 14, 15 | Team 3: 16 |

Games are dated in the order listed. A dressed goalie is on the box score with no credit. Goalie 21 is also dressed for team 3 in game G and has no credited game anywhere; he must not appear in any output. The links that follow:

| Teammate link | Span | Games | First game |
| --- | --- | --- | --- |
| 11–12 | 1950–51, kind 2, team 1 | 2 | A |
| 11–13 | 1950–51, kind 2, team 1 | 1 | C |
| 15–16 | 1950–51, kind 2, team 3 | 2 | A |
| 19–20 | 1950–51, kind 2, team 4 | 1 | C |
| 12–14 | 1951–52, kind 2, team 2 | 2 | E |
| 13–14 | 1951–52, kind 2, team 2 | 1 | F |
| 17–18 | 1951–52, kind 2, team 3 | 1 | D |
| 14–15 | 1951–52, kind 3, team 2 | 2 | G |
| 16–17 | 1951–52, kind 2, team 3, goalie partners | 3 | E |

Opponent pairs and games: 11v15 2, 11v16 2, 11v19 1, 11v20 1, 12v15 2, 12v16 3, 12v17 1, 12v18 1, 13v16 1, 13v19 1, 13v20 1, 14v16 4, 14v17 1, 14v18 1, 15v16 2. A dressed goalie is nobody's opponent. Players 15 and 16 are both teammates and opponents.

Expected answers, teammates only and default filter unless stated:

- 11 → 14: distance 2, two tied chains. First is 11–12–14 (2 games beats 1), then 11–13–14.
- 11 → 16: distance 4, two tied chains. First is 11–12–14–15–16.
- 11 → 18: distance 6, through the partner hop 16–17 with game E. With goalie partners off: no path.
- 11 → 19: no path. 99 → 11: unknown player. These are different outcomes.
- 11 → 15 with regular season only: no path, because 14–15 is playoff only.
- 12 → 13 with seasons 1951–52 only: distance 2 through 14. 11 → 14 with the same filter: no path.
- Farthest from 11: distance 6, one player (18), seven reachable, two unreachable. With goalie partners off: distance 4, one player (16), five reachable, four unreachable.
- Against only, 11 → 19: distance 1, one game. Either relation, 11 → 18: distance 2, one chain, 11–12 as teammates then 12–18 as opponents.
- Opponents of 16 in order: 14 (4 games), 12 (3), 11 (2), 15 (2), 13 (1).
- Either relation with a season filter: unsupported filter.

### C-search: pure search (`packages/history/src`)

No I/O. Expected failures return through `Result` as tagged errors.

- `Filter = { competition: 'all' | 'regular' | 'playoff', fromSeason: number | null, toSeason: number | null, goaliePartners: boolean }`. Season bounds are season IDs, inclusive. The default is all competitions, no bounds, partners on.
- `Relation = 'with' | 'against' | 'either'`. `with` covers both teammate kinds. With `against` or `either`, any filter other than the default returns `UnsupportedFilter`.
- `makeGraph(arrays) → Graph` builds adjacency lists from §C-graph.
- `link(graph, a, b, filter)` returns the passing spans, their total games, the evidence game (the first game of the first passing span, shared-game spans before partner spans), and the number of games as opponents.
- `opponents(graph, playerId)` returns opponents and games, most games first, then lower ID.
- `findPaths(graph, from, to, filter, relation, limit)` returns `{ distance, pathCount, pathCountCapped, paths }` in D6 order, or `NoPath`. `pathCount` stops at 1,000,000.
- `farthest(graph, from, filter)` returns `{ distance, atDistance, reachable, unreachable, example }`.
- `finalsCoverage(graph, store, playerId, fromYear, toYear)` returns, for each Final year, either a matched player with a Final game and a shared game, or a miss. It uses shared-game links only.
- Each hop is `{ _tag: 'PlayedWith' | 'GoaliePartners' | 'PlayedAgainst', from, to, games }`. The two teammate kinds add `teamId, seasonId, gameType, gameId`. `PlayedAgainst` has no game; the API handler adds the first one from the store. In `either`, a pair linked both ways is reported as teammates.
- Player IDs, never indexes, cross this boundary.

### C-store: storage port

`HistoryStore` is an interface in `packages/history/src/store.ts`. `tests/fakes.ts` has an in-memory fake over §C-mini.

- `snapshotId`, `graph`
- `searchPlayers(query, limit)`: matches `search_name`, most games first.
- `player(playerId)`: the player row and his stints, with team abbreviation and name.
- `roster(teamId, seasonId, gameType)`: players with games for that stint.
- `sharedGames(a, b, seasonId, gameType, teamId)`: game IDs and dates for one span.
- `opposedGames(a, b)`: every game on opposite sides, with date and each player's team.
- `finals(fromYear, toYear)`: for each Final, the season, the game IDs, and the participants.

### C-rpc: API contract

`HistoryRpcs` in `packages/history/src/contracts.ts`, exported as `@nhl-reddit-stats/history/rpc`. Served at `/api/history` by its own function, so the serving file is not loaded by the season function. Every success carries `snapshotId`.

| Call | Input | Returns |
| --- | --- | --- |
| `SearchPlayers` | `query, limit ≤ 20` | Players with position, first and last season, games |
| `GetPlayer` | `playerId` | Player and stints |
| `GetRoster` | `teamId, seasonId, gameType, focusPlayerId?` | Roster. With a focus player, each row adds the link to him: games together and an evidence game, marked as goalie partners where that is the only tie, or no link |
| `GetLink` | `a, b, filter` | Spans, total games together, evidence game, and games as opponents |
| `GetSharedGames` | `a, b, seasonId, gameType, teamId` | Games in one span |
| `GetOpponents` | `playerId, limit ≤ 50, offset` | Opponents with games, most first, and the total count |
| `GetOpposedGames` | `a, b` | Every game on opposite sides |
| `FindPath` | `from, to, filter, relation, limit ≤ 10` | §C-search `findPaths` result |
| `GetFarthest` | `playerId, filter` | §C-search `farthest` result |
| `GetFinalsCoverage` | `playerId, fromYear, toYear` | Per-year match or miss, and the rule text |

Tagged errors: `HistoryUnavailable`, `UnknownPlayer { playerId }`, `UnknownRoster`, `NoPath { from, to }`, `UnsupportedFilter`.

### C-accept: acceptance cases

Run on a full snapshot by **T2**. Exact values hold for the baseline snapshot. On a later snapshot, counts may only grow and the historical answers must not change.

| Case | Baseline |
| --- | --- |
| Players, shared-game pairs, shared-game spans | 8,842 · 478,383 · 1,049,918 |
| Opponent pairs | 3,273,864 |
| Goalie-partner spans and the pairs they add | 5,862 · 1,126 (first full run, snapshot `e10c93faedc3`, Nov 17). **T1** and the serving build must agree. |
| Components; diameter with goalie partners off | 1 · 9 |
| McDavid shared-game teammates; distance to Lindsay | 174 · 5 |
| McDavid and Draisaitl | 879 games together |
| Johansen and Jones, 2015–16 shared games | 0 |
| Cleghorn, game `1918020026` | One shared game with each Ottawa teammate in it |
| Hill and Samsonov | Goalie partners at Vegas in 2024–25, with an evidence game |
| Ranford and Joseph | Reported. No link is expected. |
| Jágr shared-game teammates; Finals covered 1980–2026 | 518 · 45 of 46, missing 2022 |
| Seasons with a flagged Cup Final | 99, each with exactly two teams |
| Truth parity | For the 200 player pairs listed in the truth file, distance and tied-chain count match **T1**, with goalie partners on and off |

### C-ops: where artifacts live

- Release `nhl-history-archive`: completed-season archives, both the game reports and the dressed goalies. `data/history/manifest.json` in git lists each file's name, bytes, and SHA-256.
- Release `nhl-history-serving`: one gzipped serving file per snapshot, named by snapshot ID.
- `data/history/serving.json` in git: `{ snapshotId, url, sha256, bytes }`. A missing pointer is allowed; the API then answers `HistoryUnavailable`.
- The two most recent seasons are fetched from the NHL on every refresh and are not stored. Box scores are fetched only for games not seen before.

## Critical path

```
H0 ─┬─ I1 (the backfill runs once: about 70,000 requests)
    ├─ B1 ─┬─ I2 ─────────────┐
    │      └─ B2 ─┬─ B3 ──────┼──────────────────────┐
    │             ├─ B4 ──────┴─ B5 ─────────────────┤
    │             └─ B6 ─────────────────────────────┤
    ├─ T1 ───────────────────────────────────────────┤
    ├─ O4                                            │
    └─ K0 ─ K1 ─┬─ Q1 ─┬─ Q2 ─┬─ Q3 ─┐               │
                │      │      ├─ Q4 ─┴─ A2b ─┐       │
                │      │      └─ Q7 ─── A2d ─┼─ C1   │
                │      └─ Q6 ────────── A2c ─┴───────┴─ T2 (full-snapshot gate)
                └─ A1 ─ A3 ─┬─ A2a (before A2b, A2c, A2d)
                            └─ V1 ─ A4
```

- **Ready the moment H0 lands:** I1, B1, O4, T1, K0. None needs another task's output.
- **Ready the moment K1 lands:** Q1 and A1. They work from the contracts and fakes, with no real data.
- **Run first:** K0 → K1 → A1 → A3 → V1, because **V1** is the one technical risk and its fallback re-plans only **A1**. Start **I1**'s backfill as early as possible too; it takes hours of clock time and no attention.
- **First working feature:** **C1**. `bun run history:query -- path "Connor McDavid" "Ted Lindsay"` prints the chain and the game behind each hop from the real snapshot.
- **Blocked on Ben:** nothing.

## Task cards

### Settled with Ben, Nov 17

- Goalies on the same game roster have played together; opponents are recorded too (D2, D14).
- Archives and the serving file go to GitHub Release assets, and republishing the NHL reports is acceptable (D11).
- The stack base is `main`, now that the lint branch has merged.
- The web explorer and the game are out of scope for now (§Later).

### Foundation

#### H0 · Land the existing import (orchestrator)

- **Needs:** nothing
- **Write:** `scripts/import-nhl-history.py`, `scripts/build-nhl-history.py`, `scripts/check_nhl_history.py`, `tests/test_build_nhl_history.py`, `tests/test_nhl_history_check.py`, and this plan, copied from the main checkout. In `.gitignore`: `__pycache__/`, `data/history/*`, `!data/history/manifest.json`, `!data/history/serving.json`. In the root `package.json`: `data:import:history` (`python3 scripts/import-nhl-history.py && python3 scripts/check_nhl_history.py --fetch && python3 scripts/build-nhl-history.py`; the uncommitted line was lost when the checkout moved to `main`), `data:build:history`, `data:build:serving`, `data:import:dressed`, `test:history` (`python3 -m unittest discover -s tests -p 'test_*.py'`), and `history:accept` and `history:query` (each runs the `apps/api` script of the same name).
- **Done:** py-check passes (5 tests). `git status` shows nothing under `data/history`. The unrelated `.agent-sources` changes in the main checkout are not in the commit.

#### K0 · Scaffold `packages/history` (Sonnet · low)

- **Needs:** H0
- **Read:** `packages/season/package.json`, its `tsconfig.json` and lint config; `packages/analyst/.oxlintrc.json`; AGENTS.md §Error model, §Union model
- **Write:** `packages/history/package.json` (exports `.` and `./rpc`; scripts `typecheck`, `lint`, `test` with `node --test tests/*.test.ts`), `tsconfig.json`, `.oxlintrc.json` with the union-model plugin, the error-model check in `lint`, `src/index.ts`, and one placeholder test. `bun.lock` if the workspace entry changes it.
- **Done:** pkg-check passes.

#### K1 · Contracts, shapes, and fakes (Sonnet · high)

- **Needs:** K0
- **Read:** this plan §C-graph, §C-mini, §C-search, §C-store, §C-rpc; `packages/season/src/contracts.ts`
- **Write:** `src/shapes.ts` (array, graph, filter, hop, and result types), `src/store.ts`, `src/contracts.ts` (schemas, tagged errors, `HistoryRpcs`), `tests/fakes.ts` (§C-mini as arrays, and the in-memory store), `tests/contracts.test.ts` (each schema round-trips one value; the fake arrays satisfy the §C-graph sort and length rules).
- **Done:** pkg-check passes. The PR lists any field this plan left ambiguous and the choice made.

### Import lane (Python, standard library only)

#### I1 · Import dressed goalies (Sonnet · medium)

- **Needs:** H0
- **Read:** `scripts/import-nhl-history.py`; this plan §C-dressed
- **Write:** `scripts/import-nhl-dressed.py` and `tests/test_import_nhl_dressed.py` with a stubbed fetch. For every game in a season archive's team rows, fetch the box score and keep each side's goalie IDs and ice time. `--season` limits a run.
  - **Resume:** rewrite the season file atomically after every 100 games and at the end of the season. A rerun skips every game already stored with data, so a crash costs at most 100 requests.
  - **Failures:** at most four requests at once, with retries and a growing wait. A rate-limit response slows the run down; it is never stored. A game that still fails is stored as `null`, and the next run tries it again. `--refresh` refetches everything.
  - **Report:** each run prints games fetched, games skipped, and games still `null`.
  - **Tests:** a run killed partway resumes without refetching stored games; a `null` game is retried; a rate-limit response is not stored.
- **Done:** py-check passes. **Gate (Archive):** the orchestrator runs the full backfill once, reruns it until no `null` games remain or the same ones keep failing, and records, per decade, the failures and the share of sides with two goalies listed.

#### I2 · Dressed goalies in the base build (Sonnet · medium)

- **Needs:** B1 (same file)
- **Read:** `scripts/build-nhl-history.py`; this plan §C-dressed
- **Write:** the builder loads each dressed file with its partition into `dressed_goalies`, matching team abbreviations to that game's sides. The partition hash covers both files, so a changed dressed file rebuilds that partition. A missing dressed file is allowed. Print how many credited goalie appearances the box scores do not list. Extend the test.
- **Done:** py-check passes. **Gate (Archive):** after the backfill, a rebuild reconciles as before; the PR records the row count and the unlisted count.

### Build lane (Python, standard library only)

#### B1 · Carry position and points into the base build (Sonnet · medium)

- **Needs:** H0
- **Read:** `scripts/build-nhl-history.py`, `tests/test_build_nhl_history.py`; this plan D9
- **Write:** the builder: `appearances` gains `position` (skater `positionCode`; `G` for goalie rows) and `points` (null when the report has none). Set `PRAGMA user_version = 2` and fail with a clear “delete and rebuild” message on an older file. Extend the test.
- **Done:** py-check passes. **Gate (Archive):** a fresh build reconciles, and a second run rebuilds 0 partitions.

#### B2 · Serving tables (Sonnet · medium)

- **Needs:** B1
- **Read:** this plan §C-base, §C-serve, D10
- **Write:** `scripts/build-nhl-serving.py` with `meta`, `players`, `teams`, `games` (`cup_final` 0), `appearances`, and `stints`; `tests/test_build_nhl_serving.py` builds a base database from an inline archive that reproduces §C-mini and checks every table. The script runs each step module named in a list; **B3** and **B4** add theirs.
- **Done:** py-check passes. Two builds of the test input are byte-identical. **Gate (Archive):** 8,842 players, 2,584,996 appearances, file under 50 MiB.

#### B3 · Cup Final flags (Haiku · medium)

- **Needs:** B2
- **Read:** this plan D8, §C-serve
- **Write:** `scripts/nhl_serving_finals.py` and its test: highest round from 1 to 8 per season, the `1987030999` override, nothing before 1926–27, and a failure if a flagged Final has other than two teams. One line in the step list.
- **Done:** py-check passes. **Gate (Archive):** 99 seasons flagged.

#### B4 · Graph arrays (Sonnet · high)

- **Needs:** B2. **Stack on:** B3 (both add a line to the step list).
- **Read:** this plan §C-graph, §C-mini
- **Write:** `scripts/nhl_serving_graph.py` and its test. One step fills a temporary `spans` table with shared-game spans. A later step packs `spans` into the teammate blobs and fills `players.teammates`; **B5** adds its rows between the two. For §C-mini without the partner row, every blob equals the exact bytes the contract implies. Fail on the size limits.
- **Done:** py-check passes. **Gate (Archive):** 478,383 links and 1,049,918 spans; the build adds under 90 s.

#### B5 · Goalie-partner spans (Sonnet · medium)

- **Needs:** B4, I2
- **Read:** this plan D2, §Define a teammate once, §C-graph, §C-mini
- **Write:** `scripts/nhl_serving_partners.py` and its test. For each game side in `dressed_goalies`, pair every two goalies who are both in `players` and are not both credited in that game, and add `span_link = 1` spans with their games and first game. Tests: the 16–17 row in §C-mini, goalie 21 ignored, and partners who also share a relief game keeping both spans. One line in the step list.
- **Done:** py-check passes. **Gate (Archive):** partner spans and added pairs match **T1**. Hill–Samsonov are linked. The PR reports Ranford–Joseph and the counts for §C-accept.

#### B6 · Opponent arrays (Sonnet · medium)

- **Needs:** B2. **Stack on:** B5 (the step list).
- **Read:** this plan D14, §C-graph, §C-mini
- **Write:** `scripts/nhl_serving_opponents.py` and its test: `opp_a`, `opp_b`, and `opp_games` from appearances on different teams in the same game. For §C-mini, the blobs equal the 15 pairs listed. Fail if a count exceeds 65,535.
- **Done:** py-check passes. **Gate (Archive):** 3,273,864 pairs; the step takes under 90 s.

#### O4 · Survive a game finishing mid-refresh (Sonnet · medium)

- **Needs:** H0
- **Read:** the three history scripts
- **Write:** when reconciliation differences are confined to the two most recent seasons, re-fetch those partitions and totals once and check again; otherwise fail as today. A test with a stubbed fetch covers both branches.
- **Done:** py-check passes.

### Search lane (TypeScript, no I/O)

#### Q1 · Graph and links (Sonnet · high)

- **Needs:** K1
- **Read:** this plan §C-graph, §C-mini, §C-search, D7
- **Write:** `src/graph.ts` (`makeGraph` for teammate links, the filter test including goalie partners, `link` without the opponent count) and `tests/graph.test.ts` covering every teammate link in §C-mini under each filter.
- **Done:** pkg-check passes.

#### Q2 · Shortest paths in a fixed order (Sonnet · high)

- **Needs:** Q1
- **Read:** this plan D6, §C-mini, §C-search
- **Write:** `src/paths.ts` (`findPaths` with limit 1) and `tests/paths.test.ts` with every path answer in §C-mini. Search from the target, then walk from the start through neighbours one step closer, in D6 order.
- **Done:** pkg-check passes.

#### Q3 · Tied chains and their count (Sonnet · medium)

- **Needs:** Q2
- **Write:** extend `src/paths.ts` and its test: `limit` above 1, `pathCount`, and the cap.
- **Done:** pkg-check passes.

#### Q4 · Farthest player (Sonnet · medium)

- **Needs:** Q2
- **Write:** `src/farthest.ts` and its test, from §C-mini, with and without filters.
- **Done:** pkg-check passes.

#### Q6 · Finals coverage (Sonnet · medium)

- **Needs:** Q1
- **Read:** this plan §C-store, the Jágr question
- **Write:** `src/finals.ts` and its test against the fake store: a hit, a miss, a teammate link that postdates the Final, and the year range.
- **Done:** pkg-check passes.

#### Q7 · Opponents and the relation mode (Sonnet · high)

- **Needs:** Q2
- **Read:** this plan D14, §C-mini, §C-search
- **Write:** opponent adjacency in `src/graph.ts`, built on first use; `opponents`; the opponent count in `link`; `relation` in `findPaths`; `UnsupportedFilter`. Tests: every opponent answer in §C-mini, and that `with` results are unchanged.
- **Done:** pkg-check passes.

### API lane

#### A1 · SQLite store (Sonnet · medium)

- **Needs:** K1
- **Read:** this plan §C-serve, §C-store, D4; `apps/api/src/boxscores.ts`
- **Write:** `apps/api/src/history-store.ts`: opens the file read-only with `node:sqlite`, copies the teammate blobs into aligned typed arrays (opponent blobs on first use), and implements `HistoryStore`, including `opposedGames`. A missing or invalid file is `HistoryUnavailable`. `apps/api/tests/history-store.test.ts` writes a §C-mini database to a temp directory and checks every method.
- **Done:** api-check passes.

#### A3 · History function and local flag (Sonnet · medium)

- **Needs:** A1
- **Read:** `apps/api/src/routes.ts`, `web-handler.ts`, `main.ts`, `scripts/build.mjs`, `README.md` §Vercel
- **Write:** `apps/api/src/history-routes.ts` (the RPC layer at `/api/history` with `SearchPlayers` and `GetPlayer`), `history-handler.ts`, a second entry in `scripts/build.mjs`, `--history <file>` in `main.ts`, `apps/web/api/history.ts`, the `apps/api/package.json` exports and scripts (`history:accept`, `history:fetch`), and a handler test.
- **Done:** api-check passes. `bun run data:serve -- --history <file>` answers both calls.

#### V1 · Prove the packaged function reads the file (Sonnet · medium)

- **Needs:** A3
- **Read:** `apps/api/README.md` §Vercel, `apps/web/scripts/check-vercel-output.mjs`, `apps/web/vercel.json`
- **Write:** the include rule that ships a `.sqlite` file with the history function, and a history check in `check-vercel-output.mjs`.
- **Done:** the orchestrator runs `vercel build --prod --standalone` in the main checkout and the check passes against a §C-mini file. The PR records the mechanism and the function size with an 80 MiB file. If the function cannot open the file, stop and report: **A1** is re-planned to read static JSON behind the same port.

#### A2a · Lookup handlers (Sonnet · medium)

- **Needs:** A3, Q1
- **Write:** `GetRoster`, `GetLink`, and `GetSharedGames` in `history-routes.ts`, with tests on the fake store, including a goalie partner and a roster-mate with no link.
- **Done:** api-check passes.

#### A2b · Path handlers (Sonnet · medium)

- **Needs:** A2a, Q3, Q4
- **Write:** `FindPath` (teammates only) and `GetFarthest`, with tests for each tagged error.
- **Done:** api-check passes.

#### A2c · Finals handler (Sonnet · medium)

- **Needs:** A2a, Q6. **Stack on:** A2b.
- **Write:** `GetFinalsCoverage` and its test. The rule text names NHL games only and the 1927 start.
- **Done:** api-check passes.

#### A2d · Opponent handlers (Sonnet · medium)

- **Needs:** A2a, Q7. **Stack on:** A2c.
- **Write:** `GetOpponents` and `GetOpposedGames`; the opponent count in `GetLink`; `relation` in `FindPath`, where the handler fills each opponent hop's first game from the store. Tests cover a pair that is both, paging, and `UnsupportedFilter`.
- **Done:** api-check passes.

#### C1 · Query command (Sonnet · low)

- **Needs:** A2b, A2c, A2d
- **Read:** `apps/api/src/history-routes.ts`, `apps/api/src/main.ts`
- **Write:** `apps/api/scripts/history-query.ts`: `path <a> <b>`, `player <name>`, `link <a> <b>`, `opponents <name>`, `farthest <name>`, and `finals <name>`, each calling the same code as the handlers on a serving file and printing plain text. A name that matches several players lists them with position and years and exits non-zero. Flags for the filters and the relation. A test runs each subcommand on the §C-mini file.
- **Done:** api-check passes. **Gate (Archive):** `path "Connor McDavid" "Ted Lindsay"` prints five hops with a game each.

#### A4 · Fetch the serving file at build (Haiku · medium)

- **Needs:** V1
- **Read:** this plan §C-ops; `apps/api/scripts/build.mjs`
- **Write:** `apps/api/scripts/fetch-history.mjs`: read the pointer, download, gunzip, verify size and SHA-256, and place the file where **V1** expects it. No pointer means a logged skip. Call it from the build. Add the pointer to `turbo.json` `globalDependencies`. A test serves a file from a local HTTP server.
- **Done:** api-check passes.

### Truth and gates

#### T1 · Reference answers (Codex)

- **Needs:** H0
- **Read:** this plan §Define a teammate once, D6, D8, §C-dressed, §C-accept; `scripts/build-nhl-history.py` for the schema only
- **Write:** `tests/test_nhl_history_truth.py` and `scripts/nhl_history_truth.py`: from the base database, with plain SQL and a dictionary search, write a JSON file with every §C-accept value and, for 200 player pairs chosen by a fixed seed, the distance and tied-chain count, with goalie partners on and off. It must not import the serving builder.
- **Done:** py-check passes on §C-mini input. **Gate (Archive):** the output matches the §C-accept baseline column.

#### T2 · Full-snapshot acceptance (Sonnet · medium)

- **Needs:** A2b, A2c, A2d, B3, B5, B6, T1
- **Write:** `apps/api/scripts/history-accept.ts`: open a serving file through the real store and search, run §C-accept, and compare with a truth file. `--baseline` demands exact values; otherwise counts may only grow. Components and diameter come from running `farthest` from every player (about 11 s).
- **Done:** api-check passes. **Gate (Archive):** `bun run history:accept -- --baseline` passes. Record the cold load time and the median of 1,000 `FindPath` calls in the PR.

### Operations

#### O1 · Run the history checks on pull requests (Haiku · low)

- **Needs:** K0
- **Read:** `.github/workflows/refresh-nhl-data.yml` for the pinned action versions
- **Write:** `.github/workflows/history-checks.yml`: on pull requests that touch `scripts/*history*`, `scripts/nhl_*`, `tests/test_*`, `packages/history`, or `apps/api`, run py-check, pkg-check, and api-check.
- **Done:** the workflow file passes `actionlint` if installed; otherwise the PR says it was not linted.

#### O2 · Archive manifest and fetch (Sonnet · medium)

- **Needs:** I1
- **Write:** `scripts/nhl-history-archive.py` with `manifest` (write `data/history/manifest.json` for the game-report and dressed-goalie files of every season except the two most recent) and `fetch` (download the release, verify each file); a test against a local HTTP server.
- **Done:** py-check passes. The orchestrator then creates the release and uploads the files (approved Nov 17) and records the release URL here.

#### O3 · Nightly refresh (Sonnet · medium)

- **Needs:** O2, O4, I2, A4, T2
- **Read:** `.github/workflows/refresh-nhl-data.yml`; this plan §C-ops
- **Write:** `.github/workflows/refresh-nhl-history.yml`: fetch the archive, import the recent seasons and their new box scores, build, run `history:accept`, upload the gzipped serving file under its snapshot ID, and commit the pointer. Skip the commit when the snapshot ID is unchanged. Gate on the same repository variable pattern as the existing refresh.
- **Done:** a manual dispatch on the default branch publishes a snapshot, and the next deploy serves it. Ben triggers the first run.

## Frontend

Added Nov 18 2026. Status: decisions made, nothing started. Owner: Ben.

The explorer has two kinds of view. **Built views** are the ones this plan already names: search, a player's clubs, rosters, a chain with its evidence, played-against lists. **Prompted views** are new: a fan types what they want to see, a model writes the visualization, and the app draws it. Both must feel like one product, stay fast, and leave room for data we have not imported yet.

This section fixes the approach, moves the app onto a framework that can render a page per URL, defines the shapes every lane works from, and runs a spike that measures what research could not settle. The explorer's own cards are written after it (**FJ1**).

The work is 56 small PRs in 12 lanes. It runs the way the backend did (§Orchestration): the orchestrator dispatches every ready card to a worktree subagent at the card's model and effort, reruns each **Done** check, runs each **Gate**, and submits through Graphite. Codex reviews every PR; Opus also reviews the Sonnet · high ones.

### Decisions

Numbering continues from §Decisions.

| # | Decision | Why |
| --- | --- | --- |
| D15 | **A prompted view is code the model writes, run in a sandbox.** It is not a pick from a catalog of chart components. | A catalog can only draw what we defined in advance. Code can draw a layout, an animation, or a 3D scene nobody listed. The cost is that code can fail or misbehave, which D17 and the repair loop (**FM3**) handle. |
| D16 | **AntV is the house visualization family.** G2 draws charts and G6 draws networks, in built and prompted views alike. L7 (maps), S2 (pivot tables), and Infographic join when a view needs them. D3 and Three.js are available inside the sandbox for views AntV cannot express. A GPU renderer (cosmos.gl) takes any view G6 cannot draw at speed. **Provisional until FJ1.** | One family gives every view the same interactions, animation, and theme, so prompted views look like the built ones. It covers the widest range of formats found, and AntV publishes agent skills for G2 5 and G6 5. Its weak spot is G6 at scale: no published benchmark near our graph, and reports of lag at a few hundred nodes. The spike measures that. |
| D17 | **The sandbox has no network and no access to the app.** The frame runs in an opaque origin. Data enters by message. The server-side agent chooses the data with bounded History RPC calls; code inside the frame never fetches. | Model-written code is untrusted. With no network it cannot leak data or call our API, and with no shared origin it cannot read cookies or the page. |
| D18 | **One theme source.** `apps/web/design/contract.json` feeds Tamagui today. An adapter turns the same values into a G2 theme, a G6 theme, and CSS variables for the frame. | Chart colours already come from `useTheme()` by contract. Built and prompted views must not drift apart. |
| D19 | **Docs for every adopted library are cached in `.agent-sources`, pinned to the installed version, and quoted in the generation prompt.** | Coding agents and the run-time model both write against the installed API, not a remembered older one. |
| D20 | **The web app moves to Next.js (App Router), built with webpack.** | The app is one page with no routes, and its share previews are built at build time for 32 teams. The explorer needs a URL, a title, and a preview image for each of 8,842 players, any pair, and any prompted view, rendered per request. The pinned Tamagui docs cover Next.js. Webpack, not Next's default Turbopack, because that is the Next integration zero-runtime supports (D21). |
| D21 | **The app is built in Tamagui's zero-runtime mode. Today's poster moves, unchanged, into one island.** Zero-runtime is one setting for the whole build: pages compile to plain elements and one stylesheet, and anything that needs the Tamagui runtime is an island, a separately loaded piece. New explorer pages are written to the mode's eight rules from the start. Visualizations, the sandbox host, and the lab are islands. | The report on today's app lists 41 violations in 12 files, all inside the poster. As one island they need no fixes, and the poster keeps working exactly as it does now. An island renders a placeholder on the server, so the poster stays out of the server HTML, as it is today (the app is client-rendered). Accepted, Nov 18: this is a beta feature, and this is a side project. Rule for new pages: anything a search engine or share preview must read cannot live in an island. |
| D22 | **No card edits a file another card owns.** Every card writes new files of its own. The few shared files have one owner each or a fixed order (§Who owns which file). Lists that many cards add to are folders the code discovers, never a file with one line per card. | It lets a dozen workers run at once and rebase into a chain without conflicts. The backend plan needed **Stack on** notes for its step list; folders remove the need. |

| D23 | **Effect Atoms hold the explorer's remote data and URL state. XState machines keep lifecycles.** `effect/reactivity` ships with the installed Effect, and `@effect/atom-react` 4.1.2 adds the React hooks. The History RPC group becomes query atoms through `AtomRpc`. Each URL parameter is an `Atom.searchParam` decoded with an Effect schema. Data a server render already loaded reaches the browser's atoms through `HydrationBoundary`. Machines stay for things with states and timeouts: the sandbox frame (**FS4**), team navigation, the box score. | It is the same Effect and the same RPC contract on both sides, so there is no second data library to keep in step. Query atoms cache, deduplicate, and expose loading and failure as one tagged value. `Atom.searchParam` gives the typed URL state that TanStack Start would have. Unproven: an island is a separate bundle, so two islands on one page may not share one Atom registry. **FX3** settles it. |

This section is the plan's one exception to “nothing calls a model at run time”: **FM3** and **FE2** call the model configured in `packages/analyst/src/llm.ts`, and each run records its model and token count.

Not chosen:

- **A component catalog as the foundation** (json-render, GPT-Vis, Vega-Lite specs). Safe and predictable, but it caps prompted views at what we listed. It may return later as a fast path for ordinary charts inside answers.
- **Raw D3 as the default vocabulary.** The highest ceiling, but every prompted view would hand-roll its own tooltips, zoom, and legends, and quality would vary from view to view. It stays as the escape hatch.
- **Apache ECharts.** Strong charts, but its graph series is a chart type, not a graph toolkit, and the product is a graph.
- **TanStack Start.** It stays on Vite and has typed URL state, which suits the explorer's filters. But Tamagui documents no server-rendering setup for it, and it reached 1.0 in October 2026. Typed URL state on Next comes from `Atom.searchParam` with our Effect schemas (D23).
- **Staying a single-page Vite app.** No per-URL titles or previews without a server render.
- **A separate data library** (TanStack Query, SWR). Atoms already speak our RPC contract and our schemas.
- **Moving the poster's machines to atoms.** They work, and they live inside the poster island.
- **`effect/ai` in place of the Vercel AI SDK.** The analyst package's model calls, traces, and evals are built on the AI SDK. Not part of this work.
- **Fixing the poster's 41 zero-runtime violations.** A rewrite of working code for no visible gain. Parts of the poster can leave the island later, one at a time, if a page needs them in server HTML.

### Baseline

Measured Nov 18 on the Vite build, with installed versions.

| Measure | Value |
| --- | --- |
| JavaScript | 780 kB (252 kB gzipped) |
| CSS | 2,614 kB (83 kB gzipped). The config ships every default Tamagui theme plus 64 team themes. |
| Zero-runtime report | 41 violations in 12 files: 14 style values not known at build time, 14 components that do not compile to one element, 6 `styled()` components used through an expression, 4 `useTheme` or `useMedia` reads, 3 runtime theme names, and one each of a provider, a prop spread, and a side-effect import |
| Zero-runtime support | Tamagui 3.3.1 enables base mode and islands for Vite and for Next with webpack |
| Versions to pin | `@effect/atom-react` 4.1.2 (installed, #124), `next` 16.4.6, `@tamagui/next-plugin` 3.3.1, `@antv/g2` 5.4.8, `@antv/g6` 5.1.1, `@antv/g6-extension-react` 0.2.7, `@antv/g-webgl` 2.1.3, `d3` 7.9.2, `three` 0.187.0, `@cosmos.gl/graph` 3.6.0, `playwright` 1.65.1 |

### C-viz: the shapes every lane works from

All of these are Effect schemas and types in a new package, `packages/viz`, written by **FC1**. It has no DOM code. Three places use it: the web app, the table builders, and the generator in `packages/analyst`.

#### Tables

The data a view receives: `{ tables: { [name]: Row[] }, notes: string }`. A `Row` is a flat record of strings, numbers, and nulls. `notes` says what each table is, one sentence each, and is also given to the model. Player IDs, never indexes, appear in rows. Booleans are 0 or 1.

Two row shapes recur. A `players` row is `{ playerId, name, position, firstSeason, lastSeason, games }`. A `teams` row is `{ teamId, abbrev, name }`.

| Table set | Input | Tables |
| --- | --- | --- |
| `chain` | `from, to`, default filter, limit 10 | `players`, `teams`, `hops { chain, step, from, to, kind, games, teamId, seasonId, gameType, gameId }` in D6 order with `chain` and `step` counted from 0, `summary { from, to, distance, pathCount, pathCountCapped }` |
| `pair` | `a, b` | `players`, `teams`, `spans { seasonId, gameType, teamId, link, games, firstGameId }`, `summary { a, b, totalGames, opposedGames }` |
| `ego` | `playerId` | `focus { playerId }`, `players` (the player and every teammate, each with `gamesWithFocus`), `links { a, b, games, firstSeason, lastSeason }` for every teammate link among them, `a < b` |
| `league` | none | `players` (each with `teammates`), `links { a, b, games, firstSeason }` for every teammate link |
| `opponents` | `a, b` | `players`, `faced { focus, opponent, games }` for both, most games first, then lower ID |
| `finals` | `playerId, fromYear, toYear` | `finals { year, seasonId, covered, playerId, finalGameId, sharedGameId }` with nulls on a miss, `players` for the matches |

**Samples.** `packages/viz/src/samples.ts` holds each table set for one §C-mini input, written by hand from §C-mini: `chain` 11 → 14, `pair` 15 and 16, `ego` 14, `league`, `opponents` 16 and 12, `finals` 12 from 1900 to 2100. Every web card develops against the samples, and every table builder is tested against them. The two are derived separately, so a mismatch means one is wrong: the worker stops and reports, and the orchestrator settles it against §C-mini.

#### Theme

`VizTheme`: `{ mode: 'light' | 'dark', background, color, muted, gold, win, loss, pending, rule, surface, highlight, brand, bright, chartWin, chartLoss, chartPositive, chartNegative, chartLine, series, fonts: { body, score } }`. Each colour is the theme value of the same name in `contract.json` (`chart-win` becomes `chartWin`). `series` is the fixed order `[chartPositive, chartNegative, gold, brand, chartWin, chartLoss, muted]` for charts with several series. A club's colour is its `team-primary` from `contract.json`.

#### View module

What the model writes: the body of one ES module with a default export.

```ts
export default function render(ctx: {
  root: HTMLElement; // draw only inside this element
  tables: Record<string, Row[]>;
  theme: VizTheme;
  size: { width: number; height: number };
  libs: { G2; G6; d3; THREE }; // the frame provides these; the module imports nothing
}): () => void; // returns its own cleanup
```

#### Frame messages

Every message has a `_tag`.

| Direction | Message | Meaning |
| --- | --- | --- |
| Host → frame | `Render { id, code, tables, theme }` | Run this view module. |
| Host → frame | `Dispose { id }` | Call the view's cleanup and clear the root. |
| Frame → host | `Ready { versions }` | The frame loaded; the library versions it carries. |
| Frame → host | `Rendered { id, ms }` | First paint finished. |
| Frame → host | `Failed { id, message }` | The module threw, or did not paint in time. |
| Frame → host | `FrameRate { id, fps }` | Sampled once a second while the view runs. |

Rules for the frame. **FS6** proves each one with a browser test.

1. It runs with scripts allowed and no same-origin access, so its origin is opaque.
2. It cannot reach the network: no fetch, XHR, WebSocket, EventSource, beacon, or WebRTC, and no image, font, or media from outside its own bundle.
3. It cannot leave: it cannot open a window, submit a form, navigate the top page, or navigate itself to another site. The page that hosts it only allows frames from our own origin.
4. It cannot read the explorer: no cookies, no storage, no access to the parent document.
5. A view that never returns must not freeze the explorer. **FS6** records what each browser does; the result decides whether the frame needs its own domain.

#### Spec functions and hosts

A built view is a pure function plus a host. The function is `(tables, theme) => spec` and has no DOM code, so it is tested on the samples. `G2Chart` (**FV4**) takes a G2 spec. `G6Graph` (**FV5**) takes `{ nodes, edges }`, a layout name, and an optional React component for nodes. The hosts own mounting, resizing, theme changes, and cleanup. A new view never repeats that work.

#### Folders the code discovers (D22)

| Folder | One file is | Found by |
| --- | --- | --- |
| `apps/web/src/islands/*Island.tsx` | One island. Basenames are unique. | The `islands` glob in `tamagui.build.ts`, set once by **FZ1** |
| `apps/web/src/viz/lab/entries/*.tsx` | One lab page: `export default { title, render }` | The lab island (**FV3**) |
| `apps/web/src/viz/bench/renderers/*.ts` | One renderer under test: `export default { name, mount(root, data, theme) }`, where `mount` resolves to `{ pan(dx, dy), zoom(factor), destroy() }` | The bench harness (**FR1**) |
| `packages/viz/src/tables/*.ts` | One table builder, imported as `@nhl-reddit-stats/viz/tables/<name>` | The package's `exports` map, set once by **FC0** |

### Who owns which file

A card writes only the files on its **Write** list. Every file not listed here is new and belongs to one card.

| File | Cards allowed to edit it |
| --- | --- |
| `apps/web/package.json`, `bun.lock` | FP1, FN1, FN6, FZ1, FS2, FS6 |
| `apps/web/next.config.js` | FN1, FN2, FN3, FS3 |
| `apps/web/vercel.json`, `turbo.json`, `apps/web/tsconfig*.json` | FN1, FN6 |
| `apps/web/app/layout.tsx` | FN1, FZ1 |
| `apps/web/app/[[...slug]]/page.tsx` | FN1, FN4, FZ1 |
| `apps/web/social/plugin.ts` | FN4, FN6 |
| The ignore file | FN1, FS2 |
| `apps/web/tamagui.build.ts` | FZ1 |
| `apps/web/tamagui.config.ts` | FZ2 |
| `apps/web/.oxlintrc.json`, `apps/web/lint/`, `apps/web/scripts/test-design-rules.mjs`, `apps/web/design/README.md` | FV2 |
| `apps/web/scripts/check-vercel-output.mjs` | FN7 |
| `packages/analyst/package.json`, `apps/api/package.json` | FP1 |
| `packages/viz/package.json`, its `tsconfig.json` and lint config | FC0 |
| `.agent-sources/sources.json`, `.agent-sources/README.md`, `AGENTS.md` | FP2, FP3, FN6 |
| This plan and its ledger | the orchestrator |

When two cards on one row are ready together, the orchestrator dispatches them in the listed order and rebases the second onto the first. A card that adds a script adds its own key (`viz:frame`, `test:browser`, a `pre` hook) and leaves existing lines alone. **FN6** keeps every script other cards added.

### Lanes

| Lane | Cards | What it delivers | Works in |
| --- | --- | --- | --- |
| **FC** contracts | 2 | The `packages/viz` package: shapes and samples | `packages/viz` |
| **FP** prep | 3 | Dependencies and cached docs | manifests, `.agent-sources` |
| **FN** Next | 7 | The app on Next.js, with API routes, previews, and the packaging check | `apps/web/app`, config |
| **FZ** zero-runtime | 3 | Zero-runtime on, the poster as an island, the first zero page | `apps/web` config, `src/islands` |
| **FT** tables | 7 | Six table builders and the export command | `packages/viz/src/tables`, `apps/api/scripts` |
| **FV** views | 11 | Theme adapter, lab, the two hosts, the chain view, two charts | `apps/web/src/viz` |
| **FR** renderers | 5 | The speed harness and three renderers under test | `apps/web/src/viz/bench` |
| **FS** sandbox | 6 | The frame, its build, its headers, its host, its boundary tests | `apps/web/src/viz/frame`, `src/islands` |
| **FM** model | 4 | Code check, prompts, generate and repair, a command | `packages/viz`, `packages/analyst/src/viz` |
| **FE** eval | 4 | Render harness, bake-off runner, report | `packages/analyst/evals/viz` |
| **FX** explorer groundwork | 3 | History query atoms, URL state atoms, and proof that atoms work across islands | `apps/web/src/explorer` |
| **FJ** judge | 1 | The decision, and the explorer's cards | this plan |

Tiers, on the scale in §Model and effort tiers:

| Tier | Cards |
| --- | --- |
| **Haiku · low** | FP1, FM4 |
| **Haiku · medium** | FT1, FT2, FT5, FT6, FV1, FV7, FV8, FV9, FV10, FV11, FM1, FE3 |
| **Sonnet · low** | FC0, FP2, FP3, FN4, FN5, FN6, FZ2, FT3, FT4, FT7, FV3, FV6, FR2, FR3, FR4, FS2, FS3, FS5, FM3, FE2, FX2 |
| **Sonnet · medium** | FN1, FN2, FN3, FZ3, FV2, FV4, FV5, FR1, FS4, FM2, FE1, FX1, FX3 |
| **Sonnet · high**, with an Opus review | FC1, FN7, FZ1, FS1, FS6 |
| **Orchestrator** | FR5, FE4, FJ1 |

Fourteen cards fit Haiku and 21 fit Sonnet at low effort, because the shapes, the samples, and the file layout are fixed here. The 13 Sonnet · medium cards are the first use of each library or framework feature; later cards copy them. The five Sonnet · high cards are where a wrong answer passes a casual test: the shared shapes, the packaged build, the zero-runtime switch, and the sandbox boundary.

### What can run at once

```
FC0 ──┬── FP1 (then FN1, below)
      │
      └ FC1 ──┬── FT1 … FT6 ── FT7
              ├── FV1, FV6, FV9, FV10
              ├── FR2, FR3, FR4 (also FP1)
              ├── FS1 ── FS2 ──┐
              ├── FS4 ─────────┼── FS5 ── FS6 (also FS3)
              ├── FM1 ── FM2 ── FM4 (also FP2, FM3)
              └── FX1 ── FX2 (also FV3)

FP1 ── FN1 ──┬── FN2 ── FN3 ──┐
             ├── FN4 ── FN5 ──┼── FN6 ──┬── FN7
             ├── FV3 ──┬── FV4 ── FV11   ├── FZ1 ── FZ3
             │         ├── FV5 ── FV8    └── FZ2
             │         └── FR1
             └── FS3

FP3, FV2, FV7, and FE3 need nothing. Every card in `apps/web`, `apps/api`, or `packages/analyst` that imports
`packages/viz` also needs FP1.

FE1 needs FS5.   FE2 needs FM3 and FE1.
FR5 needs FR1 to FR4 and FT7.   FE4 needs FE2, FE3, FM2, and FT7.
FX3 needs FX1 and FZ1.
FJ1 needs FZ3, FX2, FX3, FV8, FV11, FR5, FS6, and FE4.
```

If every card took the same time, the work would run in nine rounds:

| Round | Ready together | Width |
| --- | --- | --- |
| 1 | FC0, FP2, FP3, FV2, FV7, FE3 | 6 |
| 2 | FC1, FP1 | 2 |
| 3 | FN1, FT1 to FT6, FV1, FV6, FV9, FV10, FR2 to FR4, FS1, FS4, FM1, FM3, FX1 | 19 |
| 4 | FN2, FN4, FT7, FV3, FS2, FS3, FM2 | 7 |
| 5 | FN3, FN5, FV4, FV5, FR1, FS5, FM4, FX2 | 8 |
| 6 | FN6, FV8, FV11, FR5, FS6, FE1 | 6 |
| 7 | FN7, FZ1, FZ2, FE2 | 4 |
| 8 | FZ3, FE4, FX3 | 3 |
| 9 | FJ1 | 1 |

- **Run first:** FC0, then FC1 and FP1. Those three cards make 19 more ready.
- **The slow spine:** FC0 → FP1 → FN1 → FN2 → FN3 → FN6 → FZ1 → FZ3 → FJ1 is nine cards deep and cannot be parallelised. Keep it moving. Nothing in FT, FR, FM, or the pure half of FV waits on Next.
- **Cards on one row of §Who owns which file** that become ready in the same round are dispatched in the listed order, one after the other.
- **Blocked on Ben:** rating the screenshots in **FE4**, and the pass lines in **FJ1**.

### Worker preamble for these cards

§Worker preamble applies, with these additions.

1. Branch as `web/<id>-<slug>`.
2. Read §C-viz and §Who owns which file before the card's **Read** list.
3. Develop against `packages/viz/src/samples.ts`. Do not invent data.
4. Add to a discovered folder by adding a file. Never add a line to a registry.
5. Colours come from `VizTheme`. A colour literal in `apps/web/src/viz` fails lint once **FV2** lands; do not write one before then either.
6. For a library's API, read its cached docs in `.agent-sources` first (D19). If the cache is missing what you need, say so in the PR and then read the live docs.
7. For an Effect API, find the module in `.agent-sources/effect/index.md`, then read its declarations in the installed 4.1.2 packages: `node_modules/effect/dist/reactivity/*.d.ts` and `node_modules/@effect/atom-react/dist/*.d.ts` for Atoms, `node_modules/effect/dist/rpc/*.d.ts` for RPC.

- **viz-check** means, from `packages/viz`: `bun run typecheck && bun run lint && bun run test`.
- **web-check** means, from `apps/web`: `bun run typecheck && bun run lint && bun run check:tamagui`, plus the card's own tests.
- **analyst-check** means, from `packages/analyst`: `bun run typecheck && bun run lint && bun run test`.

### FC · Contracts

#### FC0 · Scaffold `packages/viz` (Sonnet · low)

- **Needs:** nothing
- **Read:** `packages/history/package.json`, its `tsconfig.json` and lint config; AGENTS.md §Error model, §Union model
- **Write:** `packages/viz/package.json` (name `@nhl-reddit-stats/viz`; depends on `effect` and `@nhl-reddit-stats/history`; `exports` of `"."` for `src/contracts.ts`, `"./samples"`, and `"./*": "./src/*.ts"`; scripts `typecheck`, `lint`, `test`, as in `packages/history`, including the error-model check and the union-model plugin), `tsconfig.json`, the lint config, `src/contracts.ts` as a placeholder, one placeholder test, and `bun.lock`.
- **Done:** viz-check passes.

#### FC1 · Shapes and samples (Sonnet · high, Opus review)

- **Needs:** FC0
- **Read:** this plan §C-viz, §C-mini, §C-search; `packages/history/src/shapes.ts`, `packages/history/tests/fakes.ts`; `apps/web/design/contract.json` (theme keys only)
- **Write:** `src/contracts.ts`: schemas and types for `Row`, `Tables`, each table set's rows, `VizTheme`, the six frame messages as one tagged union, and the `ViewModule`, `LabEntry`, and `BenchRenderer` types. `src/samples.ts`: the six samples named in §C-viz, written by hand from §C-mini, with player names from the fakes. `tests/contracts.test.ts`: each schema round-trips one value; each sample decodes; `hops` is in D6 order; every `a < b`; every ID in a row has a `players` row.
- **Done:** viz-check passes. The PR lists any field this plan left ambiguous and the choice made.

### FP · Prep

#### FP1 · Install the dependencies (Haiku · low)

- **Needs:** FC0 (for the workspace package)
- **Write:** in `apps/web/package.json`, at the exact versions in §Baseline: `@antv/g2`, `@antv/g6`, `@antv/g6-extension-react`, `@antv/g-webgl`, `d3`, `@types/d3`, `three`, `@types/three`, `@cosmos.gl/graph`, and `@nhl-reddit-stats/viz` and `@nhl-reddit-stats/history` as workspace dependencies; `playwright` as a dev dependency. In `packages/analyst/package.json`: `@nhl-reddit-stats/viz` and `playwright` (dev). In `apps/api/package.json`: `@nhl-reddit-stats/viz`. `bun.lock`. `@effect/atom-react` is already installed.
- **Done:** web-check and analyst-check pass. `bun run build` in `apps/web` gives the §Baseline JavaScript size, since nothing imports the new packages yet. The PR lists the installed versions.

#### FP2 · Cache the AntV docs and skills (Sonnet · low)

- **Needs:** nothing
- **Read:** `.agent-sources/README.md`, `.agent-sources/sources.json`, `scripts/refresh-agent-sources.mjs`
- **Write:** entries for G2 5, G6 5, and `antvis/chart-visualization-skills` (the `antv-g2-chart` and `antv-g6-graph` skills) in `sources.json`; the fetched docs and generated indexes under `.agent-sources/antv/`; one paragraph in `.agent-sources/README.md` and one in `AGENTS.md` §Library documentation. English pages where they exist, Chinese otherwise. Record each source's licence.
- **Done:** `node scripts/refresh-agent-sources.mjs` reproduces the files with matching checksums. The PR states the doc versions against the versions in §Baseline.

#### FP3 · Cache the Next.js docs (Sonnet · low)

- **Needs:** nothing. **Stack on:** FP2 (the same index files).
- **Read:** as **FP2**
- **Write:** the Next.js 16 docs for the App Router, route handlers, metadata and image routes, `next.config.js` (headers, `serverExternalPackages`, `outputFileTracingIncludes`), and building with webpack, under `.agent-sources/next/`, with index entries and the same two paragraphs.
- **Done:** as **FP2**.

### FN · Next.js

#### FN1 · Next beside Vite (Sonnet · medium)

- **Needs:** FP1 (the same manifest)
- **Read:** `.agent-sources/tamagui/docs.txt` §guides/next-js (App Router with webpack); `apps/web/src/main.tsx`, `src/App.tsx`, `src/ThemePreference.tsx`, `tamagui.config.ts`, `tamagui.build.ts`, `src/team-season.ts`, `scripts/check-design-files.mjs`
- **Write:** `next` and `@tamagui/next-plugin` in `apps/web/package.json`, with scripts `next:dev` and `next:build`, both on webpack. `next.config.js` with the Tamagui plugin (`appDir: true`). `app/layout.tsx`, importing the existing `src/tamagui.generated.css`. `app/[[...slug]]/page.tsx`, which renders today's `AppTheme` and `App` in the browser only: the theme code reads `localStorage` and `matchMedia` when it starts, and the config sets `disableSSR`. A tsconfig Next accepts that leaves the three existing typecheck projects working. `.next` added to the ignore file and to the folders `check-design-files.mjs` skips. The Vite scripts and files stay untouched.
- **Done:** web-check passes. `bun run next:build` passes. Under `bun run next:dev`, `/` and `/team/NJD` show the poster in both themes, and choosing a team changes the URL as it does today. `bun run build` still passes on Vite. The PR records the JavaScript and CSS sizes against §Baseline and anything the cached docs did not cover.

#### FN2 · API routes (Sonnet · medium)

- **Needs:** FN1
- **Read:** `apps/web/api/*.ts`, `apps/api/scripts/build.mjs`, `apps/api/tests/web-handler.test.ts`
- **Write:** `app/api/{rpc,games,poster,teams,history}/route.ts`. Each exports `GET` and `POST` that pass the request to the same handler's `fetch` that `apps/web/api/` uses today, on the Node runtime, never cached. In `next.config.js`: `serverExternalPackages` with `@nhl-reddit-stats/api` and `@resvg/resvg-js`, so Next does not rebundle the API. Its per-game box-score chunks must stay separate files that load one at a time.
- **Done:** web-check passes. Under `next:dev`, the poster loads its data through `/api/rpc`, and `/api/games?team=ANA` answers. A test proves one box-score request loads one chunk, as `apps/api/tests/web-handler.test.ts` does for the Vercel entry.

#### FN3 · Ship the history file with its route (Sonnet · medium)

- **Needs:** FN2
- **Read:** `apps/api/src/history-handler.ts`, `apps/web/vercel.json`; this plan **V1**, **A4**
- **Write:** `outputFileTracingIncludes` in `next.config.js`, so `history-data/nhl-serve.sqlite` ships with `/api/history` and with no other route. No change to how the handler finds the file unless the Next build puts it somewhere the two paths it tries do not cover; `HISTORY_DB` still overrides it.
- **Done:** web-check passes. With a §C-mini file staged (`HISTORY_KEEP_LOCAL=1`), `bun run next:build` followed by `next start` answers `SearchPlayers` from `/api/history`. With no file, it answers `HistoryUnavailable`. The PR names where the file lands in the build output.

#### FN4 · Team page titles and tags (Sonnet · low)

- **Needs:** FN1
- **Read:** `apps/web/social/plugin.ts`, `tests/social-pages.test.ts`, `index.html`
- **Write:** `apps/web/social/metadata.ts`: `siteOrigin`, `socialImageOrigin`, `socialDescription`, and a new `teamMetadata(team, origin)`, moved out of the plugin as pure functions. The plugin imports them from there, so Vite keeps working. `generateMetadata` in `app/[[...slug]]/page.tsx`, returning for each team the title, description, canonical URL, and Open Graph and Twitter tags that `socialHtml` writes today. `tests/social-metadata.test.ts` with the assertions from `social-pages.test.ts` that concern tags.
- **Done:** web-check passes; `bun run test:social` passes. Under `next:dev`, the HTML of `/team/NJD` carries New Jersey's title and tags, and `/` carries New Jersey's, as it does today.

#### FN5 · Team preview images (Sonnet · low)

- **Needs:** FN4
- **Read:** `apps/web/social/card.ts`, `social/plugin.ts` (`createSocialPreviews`), `tests/social-card.test.ts`
- **Write:** an image route at the path `teamMetadata` points to. It draws each team's card with the existing renderer and is generated once per team at build time (`generateStaticParams`), not per request. `tests/social-image.test.ts` with the assertions from `social-pages.test.ts` that concern the PNG.
- **Done:** web-check passes; the social tests pass. `bun run next:build` lists 32 prerendered images, and each team's image URL returns a PNG of the size `socialImageSize` names.

#### FN6 · Cut over to Next (Sonnet · low)

- **Needs:** FN3, FN5
- **Read:** `apps/web/package.json`, `vercel.json`, `turbo.json`, `apps/web/README.md`
- **Write:** `dev`, `build`, and `preview` in `apps/web/package.json` run Next on webpack; the `next:` scripts go. Remove `vite`, `@vitejs/plugin-react`, `vite.config.ts`, `index.html`, `src/main.tsx`, `social/plugin.ts`, `tests/social-pages.test.ts`, the `apps/web/api/` folder, and the `functions` block in `vercel.json`, which the route files replace; keep cancellation support for the API routes. Update `turbo.json` outputs, the tsconfig types, `apps/web/README.md`, and any `AGENTS.md` line that names Vite.
- **Done:** web-check passes; `bun run build` passes from the repository root; `git grep -i vite -- apps/web` finds nothing outside lockfiles and history.

#### FN7 · Packaging check on the Next output (Sonnet · high, Opus review)

- **Needs:** FN6
- **Read:** `apps/web/scripts/check-vercel-output.mjs`, `apps/api/README.md` §Vercel; PR #105
- **Write:** `check-vercel-output.mjs` for the output `vercel build` writes for a Next app. Keep every assertion it makes today: the RPC route answers through the packaged function with 32 clubs and 1,344 games; the three GET routes answer; a trailing slash on `/api/rpc` keeps POST (308); the history function runs on a Node with `node:sqlite`, carries its file when `--require-history` is passed, answers `HistoryUnavailable` without it, and ignores `HISTORY_DB` during the check; cancellation is supported.
- **Done:** **Gate:** the orchestrator runs `vercel build --prod --standalone` in the main checkout. The check passes with no snapshot and, with the real file staged, with `--require-history`. If the packaged history route cannot open the file, stop and report.

### FZ · Zero-runtime

#### FZ1 · Turn zero-runtime on, with the poster as one island (Sonnet · high, Opus review)

- **Needs:** FN6
- **Read:** `.agent-sources/tamagui/docs.txt` §guides/zero-runtime (all of it); this plan D21, §Baseline; `apps/web/tamagui.build.ts`, `app/layout.tsx`, `app/[[...slug]]/page.tsx`
- **Write:** `experimental.zeroRuntime` enforced in `tamagui.build.ts`, with `islands: ['src/islands/*Island.tsx']`. `src/islands/TeamPosterIsland.tsx`: today's `AppTheme` and `App`, moved without change. The page imports the island through its generated loader; the layout links the generated stylesheet and no longer wraps the app in a provider. A step that generates the loaders before typecheck, so `web-check` passes from a clean checkout. `--expect-optimizations` on the build, so a silent fall back to the full runtime fails CI. `.tamagui` stays out of git.
- **Done:** web-check passes from a clean checkout. The enforced build reports no violations. The poster looks and behaves the same in both themes, including the box-score dialog and print. The PR records JavaScript and CSS sizes against §Baseline and **FN1**, and the size of the page's own JavaScript without the island.

#### FZ2 · Narrow the theme pack (Sonnet · low)

- **Needs:** FN6
- **Read:** `apps/web/tamagui.config.ts`, `design/themes.ts`, `design/contract.json`; the zero-runtime guide §Keep generated CSS small
- **Write:** `tamagui.config.ts` ships only the themes the app uses: `light`, `dark`, the 64 team themes, and any default sub-theme a component in use needs. It stops spreading every default theme.
- **Done:** web-check passes. The poster looks the same in both themes for three teams, including the dialog. The PR records the CSS size against §Baseline.

#### FZ3 · The first zero-runtime page (Sonnet · medium)

- **Needs:** FZ1
- **Read:** the zero-runtime guide §The eight authoring rules; `apps/web/design/README.md`
- **Write:** `app/explore/page.tsx`: the explorer's landing page, written to the eight rules, with no island. A heading, two sentences on what the explorer does, a plain search field that does nothing yet, and links to three example chains. `apps/web/docs/zero-pages.md`: one page on how to write a page this way, with this page as the example. Later explorer cards copy it.
- **Done:** web-check passes and the enforced build reports no violations. The page's text is in the server HTML. The build's graph receipt shows no Tamagui module in the page's JavaScript. The PR records the page's JavaScript size.

### FT · Tables

Each builder is one file, `packages/viz/src/tables/<name>.ts`, with one test, `tests/tables-<name>.test.ts`. Each is a pure function over a `Graph` and a `HistoryStore` that returns `Tables` or a tagged error through `Effect`. Each test runs the builder on the §C-mini fake store and compares the result with the sample in `src/samples.ts`. If they differ, stop and report.

| Card | Builder | Tier | Built from |
| --- | --- | --- | --- |
| FT1 | `chain(graph, store, from, to)` | Haiku · medium | `findPaths` with limit 10, then `store.player` for names and teams |
| FT2 | `pair(graph, store, a, b)` | Haiku · medium | `link` with the default filter |
| FT3 | `ego(graph, store, playerId)` | Sonnet · low | The teammate adjacency in `makeGraph`, then `link` for each pair inside the set |
| FT4 | `league(graph, store)` | Sonnet · low | The graph arrays directly: every link, its spans summed, its earliest season |
| FT5 | `opponents(graph, store, a, b)` | Haiku · medium | `opponents` for each player |
| FT6 | `finals(graph, store, playerId, fromYear, toYear)` | Haiku · medium | `finalsCoverage` |

- **Needs (all six):** FC1
- **Read:** this plan §C-viz Tables, §C-search, §C-store; `packages/history/src/index.ts`; the sample for the card's table set
- **Done:** viz-check passes.

#### FT7 · Export command (Sonnet · low)

- **Needs:** FT1 to FT6, FP1
- **Read:** `apps/api/scripts/history-query.ts` (name lookup and `effect/cli` use), `apps/api/src/history-store.ts`
- **Write:** `apps/api/scripts/history-viz-tables.ts`: `chain <a> <b>`, `pair <a> <b>`, `ego <name>`, `league`, `opponents <a> <b>`, and `finals <name>`, each writing one `Tables` JSON file to `data/history/viz/` (ignored by git). A name that matches several players lists them and exits non-zero, as `history-query` does. A test runs each subcommand on the §C-mini file.
- **Done:** api-check passes. **Gate (Archive):** the orchestrator exports McDavid → Lindsay, McDavid with Draisaitl, Jágr, the league, Gretzky with Ovechkin, and Jágr's Finals from 1980 to 2026 from the real snapshot, and records each file's size and row counts.

### FV · Views

#### FV1 · Theme adapter (Haiku · medium)

- **Needs:** FC1, FP1
- **Read:** this plan §C-viz Theme; `apps/web/design/contract.json` (theme keys)
- **Write:** `apps/web/src/viz/theme.ts`: `vizTheme(values, mode)`, which builds a `VizTheme` from a record of theme values; `g2Theme(theme)`; `g6Theme(theme)`; `cssVariables(theme)`; `teamColor(abbrev, theme, index)`, which returns the club's `team-primary` from `contract.json`, or the `series` colour at `index` for a club with no palette. All pure. `useVizTheme()`, the one function that calls `useTheme()`. `tests/viz-theme.test.ts`: every `VizTheme` field is filled from the contract's light and dark themes, and `series` has the order in §C-viz.
- **Done:** web-check passes.

#### FV2 · No literal colours in `src/viz` (Sonnet · medium)

- **Needs:** nothing
- **Read:** `apps/web/lint/design-plugin.mjs`, `scripts/test-design-rules.mjs`, `.oxlintrc.json`, `design/README.md`
- **Write:** a `design/viz-theme-colors` rule: in files under `src/viz/`, a string that is a hex, `rgb()`, `hsl()`, or named CSS colour is an error, since colours come from `VizTheme`. One passing and one failing fixture in `test-design-rules.mjs`. One sentence in `design/README.md`.
- **Done:** `bun run lint` passes from `apps/web`, and the failing fixture fails for the stated reason.

#### FV3 · Lab route (Sonnet · low)

- **Needs:** FN1
- **Read:** this plan §C-viz Folders; `apps/web/app/[[...slug]]/page.tsx`
- **Write:** `app/viz-lab/[[...entry]]/page.tsx`, which answers 404 outside development. `src/islands/VizLabIsland.tsx`: it finds every file in `src/viz/lab/entries/`, lists their titles, and renders the chosen one with the app's theme controls. `src/viz/lab/entries/hello.tsx`, a sample entry that shows the `chain` sample as a table.
- **Done:** web-check passes. `/viz-lab` lists the sample entry under `next:dev`; a production build answers 404 for it.

#### FV4 · G2 host (Sonnet · medium)

- **Needs:** FP1, FV1, FV3
- **Read:** the cached G2 docs for the spec API, themes, and resizing; this plan §C-viz Spec functions and hosts
- **Write:** `src/viz/G2Chart.tsx`: `{ spec, height }`, where `spec` is a G2 options object and `height` a design token. It mounts the chart, applies `g2Theme`, redraws when the spec or theme changes, follows its container's width, and destroys the chart on unmount. `src/viz/lab/entries/g2-host.tsx`, a bar chart of the `league` sample's players by games.
- **Done:** web-check passes. In the lab, the chart follows the theme switch and the window width, and leaves no canvas behind after navigating away. The PR records the JavaScript the lab page gained.

#### FV5 · G6 host (Sonnet · medium)

- **Needs:** FP1, FV1, FV3
- **Read:** the cached G6 docs for the graph options, layouts, behaviours, React nodes, and renderers; this plan §C-viz Spec functions and hosts
- **Write:** `src/viz/G6Graph.tsx`: `{ data, layout, node?, renderer?, height }`. `data` is `{ nodes, edges }`; `layout` is `'dagre'` or `'force'`; `node` is an optional React component drawn for each node; `renderer` is `'canvas'` or `'webgl'`. Pan, zoom, and hover highlighting are on. It applies `g6Theme`, redraws on data or theme change, and destroys the graph on unmount. `src/viz/lab/entries/g6-host.tsx`, the `ego` sample as a force layout.
- **Done:** as **FV4**, for the graph.

#### FV6 · Chain spec (Sonnet · low)

- **Needs:** FC1, FP1
- **Read:** this plan D6, §C-viz Tables (`chain`); the `chain` sample
- **Write:** `src/viz/specs/chain.ts`: `chainGraph(tables)` returns `{ nodes, edges, chains }`. One node per player, in the order players first appear. One edge per distinct hop, labelled with the team abbreviation, the season, and the games, and carrying the evidence game ID. `chains` lists each chain's edge IDs in D6 order, for highlighting. `tests/viz-chain.test.ts` on the sample: four nodes, four edges, two chains, 11–12–14 first.
- **Done:** web-check passes.

#### FV7 · Player card (Haiku · medium)

- **Needs:** nothing
- **Read:** `apps/web/design/README.md`, `src/components/team-poster/primitives.tsx`, `tamagui-prompt.md`
- **Write:** `src/viz/PlayerCard.tsx`: `{ name, position, firstSeason, lastSeason, games, emphasis? }`. A compact card: the name, then position and years (`C · 2015–26`), then games. `emphasis` marks the two ends of a chain. Tokens only.
- **Done:** web-check passes.

#### FV8 · Chain view (Haiku · medium)

- **Needs:** FV5, FV6, FV7
- **Write:** `src/viz/lab/entries/chain.tsx`: `G6Graph` with the dagre layout, `chainGraph` on the `chain` sample, and `PlayerCard` as the node. Hovering an edge highlights every chain that uses it. A file field loads an exported `chain` file in place of the sample.
- **Done:** web-check passes. On the sample, both tied chains show, with 11–12–14 on top. **Gate:** the orchestrator loads the real McDavid → Lindsay export and attaches a screenshot in each theme.

#### FV9 · Games-by-season spec (Haiku · medium)

- **Needs:** FC1, FP1
- **Read:** the cached G2 docs for interval marks and stacking; the `pair` sample
- **Write:** `src/viz/specs/games-by-season.ts`: `gamesBySeason(tables, theme, clubColor)` returns a G2 spec. One bar per season, stacked by club, regular season and playoffs as separate facets, goalie-partner games in a muted fill. `clubColor(abbrev, index)` is a parameter, so this card does not wait for **FV1**. `tests/viz-games-by-season.test.ts` on the sample: one season, one club, two games.
- **Done:** web-check passes.

#### FV10 · Finals grid spec (Haiku · medium)

- **Needs:** FC1, FP1
- **Read:** the cached G2 docs for cell marks and tooltips; the `finals` sample
- **Write:** `src/viz/specs/finals-grid.ts`: `finalsGrid(tables, theme)` returns a G2 spec. One cell per Final year, ten to a row, filled with `win` for a hit and `rule` for a miss, with the matched player in the tooltip. A test on the sample.
- **Done:** web-check passes.

#### FV11 · Chart lab entries (Haiku · medium)

- **Needs:** FV4, FV9, FV10
- **Write:** `src/viz/lab/entries/games-by-season.tsx` and `finals-grid.tsx`: each passes its spec to `G2Chart`, with `teamColor` from `theme.ts` where the spec asks for club colours, on the sample, with a file field for an exported file.
- **Done:** web-check passes. **Gate:** the orchestrator loads the real McDavid–Draisaitl and Jágr exports and attaches a screenshot of each in both themes, with the JavaScript size the two entries add.

### FR · Renderers

#### FR1 · Speed harness (Sonnet · medium)

- **Needs:** FC1, FV3
- **Read:** this plan §C-viz Folders (`BenchRenderer`)
- **Write:** `src/viz/bench/harness.ts`: for one renderer and one `{ nodes, links }` dataset, record the time until the layout settles, then drive a fixed ten-second script of pans and zooms and record the median and the worst frame rate. `src/viz/bench/stats.ts`: the pure parts (median, worst, the script's steps), with tests. `src/viz/lab/entries/network-bench.tsx`: pick a discovered renderer and a dataset (the `ego` or `league` sample, or a loaded file), run, show a table, and offer it as JSON.
- **Done:** web-check passes. With no renderers yet, the page lists none and says so.

| Card | Renderer file | Tier | Draws with |
| --- | --- | --- | --- |
| FR2 | `renderers/g6-canvas.ts` | Sonnet · low | G6, canvas renderer, force layout |
| FR3 | `renderers/g6-webgl.ts` | Sonnet · low | G6, WebGL renderer, GPU force layout if the cached docs show one for G6 5 |
| FR4 | `renderers/cosmos.ts` | Sonnet · low | cosmos.gl |

- **Needs (all three):** FC1, FP1
- **Read:** the library's cached docs or README; `BenchRenderer` in `packages/viz/src/contracts.ts`
- **Write:** the one file. Node size from `games`, link opacity from `games`, colours from `VizTheme`.
- **Done:** web-check passes, and the renderer draws the `league` sample in the lab once **FR1** has landed.

#### FR5 · Speed gate (orchestrator)

- **Needs:** FR1 to FR4, FT7
- **Gate:** on Ben's laptop, in Chrome and Safari, run every renderer on the real `ego` (Jágr) and `league` exports. Record, for each: settle time, median and worst frame rate, and the JavaScript the renderer adds. Paste the table into §Results.

### FS · Sandbox

#### FS1 · Frame runtime (Sonnet · high, Opus review)

- **Needs:** FC1, FP1
- **Read:** this plan D17, §C-viz View module, Frame messages, and the five rules
- **Write:** `apps/web/src/viz/frame/frame.ts` and `viz-frame.html`: the frame's own page. On load it posts `Ready` with the library versions. On `Render` it decodes the message, sets the CSS variables from the theme, runs the code as a module with `{ root, tables, theme, size, libs }`, and posts `Rendered` after the first paint or `Failed` with the error. It samples the frame rate once a second and posts `FrameRate`. On `Dispose` it calls the view's cleanup and clears the root. It accepts messages only from its parent and ignores anything that does not decode. The PR states how the posted code is executed and why that route was chosen. `tests/viz-frame.test.ts` covers the message handling with a fake window.
- **Done:** web-check passes.

#### FS2 · Frame bundle (Sonnet · low)

- **Needs:** FS1
- **Read:** `apps/api/scripts/build.mjs` (for `Bun.build`)
- **Write:** `apps/web/scripts/build-viz-frame.mjs`: bundle `frame.ts` with G2, G6, D3, and Three.js into `public/viz-frame/`, with `viz-frame.html` beside it, sharing no code with the Next app. A `viz:frame` script runs it, and `predev` and `prebuild` call that script, so no other card's script line changes. `public/viz-frame/` stays out of git.
- **Done:** web-check passes. `bun run build` writes the bundle, and the PR records its size.

#### FS3 · Frame headers (Sonnet · low)

- **Needs:** FN1
- **Read:** this plan §C-viz, the five rules; the cached Next docs for `headers()`
- **Write:** in `next.config.js`: response headers for `/viz-frame/*` that sandbox the document with scripts only and allow nothing from the network, and a header on the app's pages that only allows frames from our own origin. A starting policy for the frame: `sandbox allow-scripts; default-src 'none'; script-src 'self' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; webrtc 'block'; base-uri 'none'; form-action 'none'`. **FS6**'s tests are the authority; this card states what it could not check by hand.
- **Done:** web-check passes. Under `next:dev`, the headers are present on both paths.

#### FS4 · Frame lifecycle (Sonnet · medium)

- **Needs:** FC1, FP1
- **Read:** `apps/web/src/boxscore-machine.ts`, `tests/boxscore-machine.test.ts`; `.agent-sources/ratstack/index.md` for `add-a-lifecycle-machine`; this plan §C-viz Frame messages
- **Write:** `src/viz/frame/frame-machine.ts`: states `loading`, `ready`, `rendering`, `rendered`, `failed`, and `timedOut`. `Ready` moves `loading` to `ready`. A render request moves to `rendering` and records its `id`. A `Rendered` or `Failed` with that `id` settles it; one with another `id` is ignored. No answer in time moves to `timedOut`, which the host answers by replacing the frame. The time limit is an input, not a constant. `tests/viz-frame-machine.test.ts` covers each transition, a stale `id`, and a timeout.
- **Done:** web-check passes.

#### FS5 · Frame host (Sonnet · low)

- **Needs:** FS2, FS4, FV3
- **Write:** `src/islands/VizFrameIsland.tsx`: `{ code, tables }`. It renders the frame, runs `frame-machine`, posts `Render` with the current `VizTheme`, validates every message from the frame, shows a plain message on `failed`, and replaces the frame on `timedOut`. `src/viz/lab/entries/sandbox.tsx`: a text area holding a hand-written view module for the `chain` sample, a run button, and the last messages received.
- **Done:** web-check passes. In the lab, the sample module draws, an edit that throws shows `Failed`, and the theme switch redraws it.

#### FS6 · Boundary tests (Sonnet · high, Opus review)

- **Needs:** FS3, FS5
- **Read:** this plan §C-viz, the five rules
- **Write:** `apps/web/tests/browser/sandbox.spec.ts`, run with Playwright against a production build. One test for each clause of the five rules. Each runs a view module that attempts the forbidden thing and reports through `Failed` or `Rendered` whether it worked: a fetch to `/api/rpc`, an XHR, a WebSocket, a beacon, an image from another host, `document.cookie`, `localStorage`, `parent.document`, `window.open`, a form post, `top.location`, and `location` set to another site. One more runs an endless loop and records, for Chromium, WebKit, and Firefox, whether the explorer still responds to a click and how long the host takes to replace the frame. A `test:browser` script.
- **Done:** every boundary test passes in all three browsers, or the PR names the rule a browser does not hold and the header or attribute that would fix it. The endless-loop table is in the PR.

### FM · Model

#### FM1 · Code check (Haiku · medium)

- **Needs:** FC1
- **Read:** this plan §C-viz View module
- **Write:** `packages/viz/src/check-view-code.ts`: `checkViewCode(code)` returns the list of problems or none. A problem is: no default export; an `import` or `require`; or any of `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `RTCPeerConnection`, `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB`, `window.parent`, `window.top`, `window.open`, `location`, `eval`, or `new Function`. It is a filter for honest mistakes, which lets the model repair them before the frame ever runs; the frame is the boundary (D17), and the file says so. `tests/check-view-code.test.ts`: one passing module and one failing module for each problem.
- **Done:** viz-check passes.

#### FM2 · Prompts (Sonnet · medium)

- **Needs:** FC1, FP1, FP2, FM1
- **Read:** `packages/analyst/src/prompts/generate.md`, `src/prompt.ts`; the cached G2 and G6 docs and AntV skills; this plan §C-viz, D16
- **Write:** `packages/analyst/src/prompts/view-antv.md` and `view-d3.md`. Each states the view-module contract, the `VizTheme` fields, the rules (draw only in `root`, no imports, no network, return a cleanup, use theme colours), and how the tables and their `notes` arrive. `view-antv.md` says to use G2 for charts and G6 for networks first, with D3 and Three.js for what they cannot do, and quotes the cached docs for the pinned versions. `view-d3.md` allows D3 and Three.js only. Each ends with one complete, working view module for the `chain` sample.
- **Done:** analyst-check passes. Both example modules pass `checkViewCode` in a test.

#### FM3 · Generate and repair (Sonnet · low)

- **Needs:** FC1, FP1
- **Read:** `packages/analyst/src/llm.ts`, `rank.ts` (a structured model call), `ask.ts`
- **Write:** `packages/analyst/src/viz/generate.ts`: `generateView({ prompt, tables, notes, system })` returns `{ title, code, model, usage }` or a tagged error, through the `Llm` service. The system prompt is a parameter, so this card does not wait for **FM2**. `repairView({ code, failure, system })` asks again with the frame's `Failed` message or the problems from `checkViewCode`. `generateChecked(...)` generates, runs `checkViewCode`, and repairs at most twice. Tests use a stubbed model: a clean first answer, one repaired answer, and one that fails three times.
- **Done:** analyst-check passes.

#### FM4 · Generate command (Haiku · low)

- **Needs:** FM2, FM3
- **Read:** `packages/analyst/scripts/ask.ts`
- **Write:** `packages/analyst/scripts/generate-view.ts`: `--prompt`, `--tables <file>`, `--vocabulary antv|d3`, `--out <file>`. It prints the title, model, tokens, and repairs used. A `view:generate` script is not added; run it with `node`.
- **Done:** analyst-check passes.

### FE · Eval

#### FE1 · Render harness (Sonnet · medium)

- **Needs:** FS5
- **Read:** `apps/web/src/viz/lab/entries/sandbox.tsx`, `packages/viz/src/contracts.ts`
- **Write:** `packages/analyst/evals/viz/render.ts`: `renderView({ baseUrl, code, tables })`. With Playwright, open the lab's sandbox entry, submit the code and tables, wait for `Rendered` or `Failed`, collect ten seconds of `FrameRate`, and take a screenshot. It returns `{ outcome, firstPaintMs, medianFps, screenshotPath }` or a tagged error. A test runs it against a small stub page that speaks the frame messages.
- **Done:** analyst-check passes.

#### FE2 · Bake-off runner (Sonnet · low)

- **Needs:** FM3, FE1
- **Read:** `packages/analyst/evals/run.ts`, `runner.ts`
- **Write:** `packages/analyst/evals/viz/bakeoff.ts` and `prompts.json` (the five prompts below). For each prompt and each vocabulary: generate, render, repair on `Failed` at most twice, and write one record: `{ prompt, dataset, vocabulary, outcome, repairs, model, tokens, firstPaintMs, medianFps, screenshotPath, code }`. Records go to `data/history/viz/bakeoff/`. Tests use a stubbed model and a stubbed renderer.
  1. `chain`: “Show how McDavid connects to Ted Lindsay, and make each hop feel like a jump through time.”
  2. `ego`: “Draw Jágr's career as a galaxy of teammates, clustered by club, brightest where he played the most.”
  3. `league`: “Animate the league's teammate network growing season by season from 1917.”
  4. `opponents`: “Compare who Gretzky and Ovechkin played against. Who did both face, and how often?”
  5. `finals`: “Make something wild out of the 45 Finals that Jágr's teammates played in.”
- **Done:** analyst-check passes.

#### FE3 · Bake-off report (Haiku · medium)

- **Needs:** nothing (the record shape is in **FE2**)
- **Write:** `packages/analyst/evals/viz/report.ts`: `bakeoffReport(records)` returns one self-contained HTML page. For each prompt, the two results sit side by side in a random order, labelled A and B, with a screenshot and no vocabulary name. A key at the bottom, hidden until opened, says which was which. Below it, a table by vocabulary: rendered, repairs, tokens, first paint, median frame rate. A test builds a report from four hand-written records.
- **Done:** analyst-check passes.

#### FE4 · Bake-off gate (orchestrator)

- **Needs:** FE2, FE3, FM2, FT7
- **Gate:** run the bake-off once on the real exports with the configured generate model: at most 30 model calls. Ben rates the five pairs blind. Paste the table and the ratings into §Results. If the two vocabularies are close, run once more with a stronger model before deciding.

### FX · Explorer groundwork

#### FX1 · History query atoms (Sonnet · medium)

- **Needs:** FP1
- **Read:** `AtomRpc.d.ts`, `Atom.d.ts`, and `AsyncResult.d.ts` in `node_modules/effect/dist/reactivity/` for `AtomRpc`, `Atom.family`, and `AsyncResult`; `apps/web/src/season-source.ts` (the RPC protocol layer); this plan §C-rpc, D23
- **Write:** `apps/web/src/explorer/history-atoms.ts`: `HistoryClient`, an `AtomRpc` service over `HistoryRpcs` at `/api/history`, and one query-atom function for each call the explorer reads: `searchPlayers`, `player`, `roster`, `link`, `sharedGames`, `opponents`, `opposedGames`, `findPath`, `farthest`, and `finalsCoverage`. Each takes the call's payload and returns the same atom for the same payload. Each sets a serialization key, so a server render can hand its result to the browser, and a time to live. `tests/history-atoms.test.ts` reads each atom through an `AtomRegistry`, with no React, against the in-memory fake store behind the real handler: a success, `UnknownPlayer`, and `HistoryUnavailable` when the transport fails.
- **Done:** web-check passes. The PR records what the cached docs did not cover.

#### FX2 · URL state atoms (Sonnet · low)

- **Needs:** FX1, FV3
- **Read:** `node_modules/effect/dist/reactivity/Atom.d.ts` for `Atom.searchParam`; `packages/history/src/contracts.ts` (the `Filter` and `Relation` schemas); this plan D7
- **Write:** `apps/web/src/explorer/url-state.ts`: one `Atom.searchParam` for each of `from`, `to`, `relation`, `competition`, `fromSeason`, `toSeason`, and `partners`, each decoded with a synchronous Effect schema; `filterAtom`, which derives a `Filter` from them with the defaults in §C-search; `pathAtom`, which reads `findPath` for the current URL, or nothing while `from` or `to` is missing. `src/viz/lab/entries/url-state.tsx`: fields for each parameter and the decoded values beside them.
- **Done:** web-check passes. In the lab, editing a field changes the URL, loading a URL fills the fields, a value that does not decode shows as missing, and the back button restores the earlier state.

#### FX3 · Atoms across islands and from the server (Sonnet · medium)

- **Needs:** FX1, FZ1
- **Read:** `RegistryContext.d.ts` and `ReactHydration.d.ts` in `node_modules/@effect/atom-react/dist/` (`RegistryProvider`, `HydrationBoundary`); `node_modules/effect/dist/reactivity/Hydration.d.ts` for `Hydration`; the zero-runtime guide §Full-runtime islands
- **Write:** a lab page with two islands that read and write one atom, and a third that reads `player` for an ID the server component already loaded and passed through `HydrationBoundary`. `apps/web/docs/atoms.md`: how islands share atoms, how server-loaded data reaches them, and what does not work.
- **Done:** web-check passes. The PR answers, with evidence from the page: do two islands share one registry without help, and if not, what makes them; does the third island show the player with no request to `/api/history`.

### FJ · Judge

#### FJ1 · Decide and write the explorer cards (orchestrator)

- **Needs:** FZ3, FX2, FX3, FV8, FV11, FR5, FS6, FE4
- **Write:** in §Results: the numbers from each gate and the pass lines agreed with Ben. Then, in this section: D16 confirmed or changed; the renderer for each network view; whether the frame gets its own domain; which libraries load on demand; whether new pages stay zero-runtime by default. Then the cards for the explorer's built views, including its routes, built on the query atoms (**FX1**) and URL atoms (**FX2**) in the way **FX3** proved, and for the prompted-view service, with progress streamed over a streaming RPC and results cached with `effect/persistence`: how the agent chooses bounded History queries for a prompt, cost and rate limits, caching by prompt and snapshot ID, and how a prompted view that works well is promoted to a built one.
- **Done:** Ben approves the section.

What the spike decides. No pass line is set in advance; each gate records its numbers first.

| Question | Measured by | Decides |
| --- | --- | --- |
| Can G6 draw one player's teammate network smoothly? | **FR5**, Jágr's 518 teammates | Whether G6 keeps the network views |
| Can anything draw the whole league (8,842 players, 478,383 links)? | **FR5**, G6 on WebGL against cosmos.gl | Which renderer gets that view, or that it is cut |
| Does the model write better views with AntV or with D3 and Three.js? | **FE4**, five prompts, both vocabularies | D16's default vocabulary |
| Does a runaway view freeze the page? | **FS6**, per browser | Same-host frame or a separate domain |
| What does each library cost to load? | **FV4**, **FV5**, **FV11**, **FR5**, **FS2** | Which libraries load on demand |
| What does zero-runtime save? | **FZ1**, **FZ3**, sizes against §Baseline | Whether explorer pages stay zero-runtime by default |

### Results

Filled as the gates run. Snapshot 4b755090e186 (8,842 players, latest game 2026-11-16).

**FT7 · exports from the real snapshot**

| Export | File | Rows |
| --- | --- | --- |
| `chain` McDavid → Lindsay | 18 kB | distance 5, 297 tied chains, 10 listed: 19 players, 11 teams, 50 hops |
| `pair` McDavid, Draisaitl | 4 kB | 20 spans, 879 games together, 0 opposed |
| `ego` Jágr | 2.3 MB (141 kB gzipped) | 519 players, 15,280 links |
| `league` | 56.3 MB (3.7 MB gzipped) | 8,842 players, 478,383 links |
| `opponents` Gretzky, Ovechkin | 1.4 MB (122 kB gzipped) | 4,824 players, 5,105 faced rows |
| `finals` Jágr, 1980–2026 | 14 kB | 46 Finals, 45 covered, 28 players |

**FN7 · packaging on a local `vercel build --prod --standalone`** (nothing uploaded)

- With no snapshot the check passes: 32 clubs and 1,344 games through the packaged RPC function, the three GET routes, cancellation on all 12 function entries, and `HistoryUnavailable` from the history function.
- With the real snapshot and `--require-history` it passes once the history route has its own function config: `history.func` is 82 MB with the file, and the other five routes share a 7.7 MB function without it. With one shared config, Vercel built a single 87 MB function for all six routes.

**FV11 · chart entries on the real exports**

- The McDavid and Draisaitl pair export (20 spans, 879 games) and Jágr's Finals export (46 Finals, 45 covered) load and draw in both themes with no page errors.
- Dark-theme axis labels were unreadable at first: G2 does not pass a facet's theme to its child views. `G2Chart` now gives each child the theme.

**FE1 · render harness against the real sandbox page**

- The example module from the AntV prompt rendered in the frame: first paint 34 ms, median 60 frames a second. A module that throws reported `Failed` with its message.

**FV8 · chain view on the real McDavid → Lindsay export**

- It loads and draws in both themes, and hovering an edge highlights every chain through it.
- Seen for FJ1: edge labels are too small and overlap; some edges pass behind cards; the chain list showed IDs (fixed to names).

**Sizes so far**

| What                                     | Raw      | Gzipped |
| ---------------------------------------- | -------- | ------- |
| Frame page (G2, G6, D3, Three.js inline) | 3.14 MB  | 0.90 MB |
| JavaScript G2 adds to a page             | 1.33 MB  | 391 kB  |
| JavaScript G6 adds to a page             | 1.80 MB  | 497 kB  |
| Stylesheet before FZ2                    | 2,588 kB | 49 kB   |
| Stylesheet after FZ2                     | 1,047 kB | 22 kB   |

- Decoding a 500,000-row table inside the frame takes about half a second, with the frame unresponsive meanwhile.
- cosmos.gl's own simulation-end signal took 84 s on the ten-node sample in one run, so "settle time" by that signal is not comparable with G6's; decide what settle means before FR5.
- G6 5's GPU layouts need `@antv/layout-gpu`, which is not installed.
- The frame is given no club palette, so prompted views cannot colour by club.
- `Atom.searchParam` debounces writes for 500 ms inside the library and does not cancel them on Back, so a Back within that window is undone. FX2 adds `writeSearchParam`; explorer cards should write URL state through it and read through the atoms.
- Under zero-runtime, an island gets `react`, `react-dom` and `react/jsx-runtime` from the host and bundles everything else, so any library that imports `react-dom/client` itself gets a second, mismatched React.

### Frontend ledger

| ID | Title | Tier | Needs | Branch | PR | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FC0 | Scaffold `packages/viz` | Sonnet · low | — | `web/fc0-viz-scaffold` | #129 | merged Nov 18 |
| FC1 | Shapes and samples | Sonnet · high | FC0 | `web/fc1-viz-shapes` | #131 | merged Nov 18 |
| FP1 | Install the dependencies | Haiku · low | FC0 | `web/fp1-viz-deps` | #130 | merged Nov 18 |
| FP2 | Cache the AntV docs and skills | Sonnet · low | — | `web/fp2-antv-docs` | #154 | PR open; reviewed |
| FP3 | Cache the Next.js docs | Sonnet · low | — | `web/fp3-next-docs` | #155 | PR open; reviewed |
| FN1 | Next beside Vite | Sonnet · medium | FP1 | `web/fn1-next-beside-vite` | #133 | merged Nov 18 |
| FN2 | API routes | Sonnet · medium | FN1 | `web/fn2-api-routes` | #159 | PR open; reviewed. Escalated: see note 1 |
| FN3 | Ship the history file with its route | Sonnet · medium | FN2 | `web/fn3-history-file` | #160 | PR open; reviewed |
| FN4 | Team page titles and tags | Sonnet · low | FN1 | `web/fn4-team-metadata` | #157 | PR open; reviewed |
| FN5 | Team preview images | Sonnet · low | FN4 | `web/fn5-team-images` | #162 | PR open; reviewed |
| FN6 | Cut over to Next | Sonnet · low | FN3, FN5 | `web/fn6-cutover` | #172 | PR open; reviewed, fixes in a second commit |
| FN7 | Packaging check on the Next output | Sonnet · high | FN6 | `web/fn7-packaging-check` | #174 | PR open; reviewed. Gate passed, and passed again on the revised check: see §Results |
| FZ1 | Turn zero-runtime on, poster as one island | Sonnet · high | FN6 | `web/fz1-zero-runtime` |  | second round in progress at Sonnet · xhigh: see note 10 |
| FZ2 | Narrow the theme pack | Sonnet · low | FN6 | `web/fz2-theme-pack` | #173 | PR open; reviewed, fixes in a second commit |
| FZ3 | The first zero-runtime page | Sonnet · medium | FZ1 |  |  | not started |
| FT1 | `chain` tables | Haiku · medium | FC1 | `web/ft1-chain-tables` | #136 | PR open; reviewed |
| FT2 | `pair` tables | Haiku · medium | FC1 | `web/ft2-pair-tables` | #137 | PR open; reviewed |
| FT3 | `ego` tables | Sonnet · low | FC1 | `web/ft3-ego-tables` | #138 | PR open; reviewed |
| FT4 | `league` tables | Sonnet · low | FC1 | `web/ft4-league-tables` | #139 | PR open; reviewed |
| FT5 | `opponents` tables | Haiku · medium | FC1 | `web/ft5-opponents-tables` | #140 | PR open; reviewed |
| FT6 | `finals` tables | Haiku · medium | FC1 | `web/ft6-finals-tables` | #141 | PR open; reviewed |
| FT7 | Export command | Sonnet · low | FT1–FT6, FP1 | `web/ft7-export-command` | #163 | PR open; reviewed. Gate run: see §Results |
| FV1 | Theme adapter | Haiku · medium | FC1, FP1 | `web/fv1-theme-adapter` | #144 | PR open; reviewed. The dim dark-theme axis labels were FV4's to fix: facet children lost the theme |
| FV2 | No literal colours in `src/viz` | Sonnet · medium | — | `web/fv2-viz-color-lint` | #132 | merged Nov 18 |
| FV3 | Lab route | Sonnet · low | FN1 | `web/fv3-lab-route` | #156 | PR open; reviewed |
| FV4 | G2 host | Sonnet · medium | FP1, FV1, FV3 | `web/fv4-g2-host` | #166 | PR open; reviewed, fixes in a second commit |
| FV5 | G6 host | Sonnet · medium | FP1, FV1, FV3 | `web/fv5-g6-host` | #168 | PR open; reviewed, fixes in a second commit |
| FV6 | Chain spec | Sonnet · low | FC1, FP1 | `web/fv6-chain-spec` | #143 | PR open; reviewed twice |
| FV7 | Player card | Haiku · medium | — | `web/fv7-player-card` | #142 | PR open; reviewed |
| FV8 | Chain view | Haiku · medium | FV5, FV6, FV7 | `web/fv8-chain-view` | #171 | PR open; reviewed. Gate run: see §Results |
| FV9 | Games-by-season spec | Haiku · medium | FC1, FP1 | `web/fv9-games-by-season` | #145 | PR open; reviewed |
| FV10 | Finals grid spec | Haiku · medium | FC1, FP1 | `web/fv10-finals-grid` | #146 | PR open; reviewed |
| FV11 | Chart lab entries | Haiku · medium | FV4, FV9, FV10 | `web/fv11-chart-lab-entries` | #175 | PR open; reviewed. Gate run: see §Results |
| FR1 | Speed harness | Sonnet · medium | FC1, FV3 | `web/fr1-bench-harness` | #165 | PR open; reviewed, fixes in a second commit |
| FR2 | G6 canvas renderer | Sonnet · low | FC1, FP1 | `web/fr2-g6-canvas` | #149 | PR open; reviewed. Ran the league sample in the harness after its fix (worker's run) |
| FR3 | G6 WebGL renderer | Sonnet · low | FC1, FP1 | `web/fr3-g6-webgl` | #150 | PR open; reviewed. Ran the league sample in the harness after its fix (worker's run) |
| FR4 | cosmos.gl renderer | Sonnet · low | FC1, FP1 | `web/fr4-cosmos` | #151 | PR open; reviewed. Ran the league sample in the harness; settle time is very long: see §Results |
| FR5 | Speed gate | Orchestrator | FR1–FR4, FT7 |  |  | not started |
| FS1 | Frame runtime | Sonnet · high | FC1, FP1 | `web/fs1-frame-runtime` | #148 | PR open; reviewed (Codex and orchestrator) |
| FS2 | Frame bundle | Sonnet · low | FS1 | `web/fs2-frame-bundle` | #158 | PR open; reviewed |
| FS3 | Frame headers | Sonnet · low | FN1 | `web/fs3-frame-headers` | #161 | PR open; reviewed |
| FS4 | Frame lifecycle | Sonnet · medium | FC1, FP1 | `web/fs4-frame-machine` | #147 | PR open; reviewed |
| FS5 | Frame host | Sonnet · low | FS2, FS4, FV3 | `web/fs5-frame-host` | #176 | PR open; reviewed, fixes in a second commit |
| FS6 | Boundary tests | Sonnet · high | FS3, FS5 |  |  | ready; waits for FZ1 (shared `package.json`) |
| FM1 | Code check | Haiku · medium | FC1 | `web/fm1-check-view-code` | #134 | merged Nov 18 |
| FM2 | Prompts | Sonnet · medium | FC1, FP1, FP2, FM1 | `web/fm2-view-prompts` | #164 | PR open; reviewed, fixes in a second commit |
| FM3 | Generate and repair | Sonnet · low | FC1, FP1 | `web/fm3-generate-repair` | #135 | PR open; reviewed |
| FM4 | Generate command | Haiku · low | FM2, FM3 | `web/fm4-generate-command` | #169 | PR open; reviewed, fixes in a second commit |
| FE1 | Render harness | Sonnet · medium | FS5 | `web/fe1-render-harness` | #177 | PR open; reviewed, fixes in a second commit. Ran against the real sandbox page |
| FE2 | Bake-off runner | Sonnet · low | FM3, FE1 | `web/fe2-bakeoff-runner` | #178 | PR open; reviewed, fixes in a second commit. No model called yet |
| FE3 | Bake-off report | Haiku · medium | — | `web/fe3-bakeoff-report` | #153 | PR open; reviewed |
| FE4 | Bake-off gate | Orchestrator | FE2, FE3, FM2, FT7 |  |  | not started |
| FX1 | History query atoms | Sonnet · medium | FP1 | `web/fx1-history-atoms` | #152 | PR open; reviewed |
| FX2 | URL state atoms | Sonnet · low | FX1, FV3 | `web/fx2-url-state` | #170 | PR open; reviewed, fixes in a second commit |
| FX3 | Atoms across islands and from the server | Sonnet · medium | FX1, FZ1 |  |  | not started |
| FJ1 | Decide and write the explorer cards | Orchestrator | FZ3, FX2, FX3, FV8, FV11, FR5, FS6, FE4 |  |  | not started |

Updated Nov 18 2026 by the frontend orchestrator. Six PRs merged (#129 to #134: FC0, FP1, FC1, FV2, FN1, FM1). 43 card PRs are open in one Graphite stack on `main`, #135 to #166 and #168 to #178, with this ledger (#167) on top. Stack order: FM3, FT1–FT6, FV7, FV6, FV1, FV9, FV10, FS4, FS1, FR2–FR4, FX1, FE3, FP2, FP3, FV3, FN4, FS2, FN2, FN3, FS3, FN5, FT7, FM2, FR1, FV4, FV5, FM4, FX2, FV8, FN6, FZ2, FN7, FV11, FS5, FE1, FE2. From FM2 upward, review fixes are a second commit on each branch.

Ledger notes:

1. **FN2 escalated.** It failed its Done check twice: `next:build` failed its type check, then review showed Next rebundling the API (`serverExternalPackages` does not match a workspace symlink). Round two ran at Sonnet · high instead of Sonnet · medium and passed.
2. **FV2 grew.** The design lint treated every object literal under `src/` as a Tamagui style, so no G2 or G6 spec could pass. Five cards stopped on it. FV2 now scopes the three object-literal rules, in `src/viz` and `src/explorer`, to objects Tamagui reads, and exempts `src/viz/frame/frame.ts` from two rules. Colour literals stay banned in `src/viz`. This is a decision for Ben to confirm in #132.
3. **Refresh scripts.** FP2 and FP3 each added their own refresh script (`refresh-antv-sources.mjs`, `refresh-next-sources.mjs`); the script their cards name is Tamagui-only.
4. **Analyst test glob.** FP1 added `evals/viz/*.test.ts` to the analyst `test` script so the FE cards' tests run.
5. **Canaries.** FT1, FV6 and FM1 passed against the samples before the rest of round 3 opened. Codex checked all 62 sample rows against §C-mini.
6. **Plan gaps found.** `bun.lock` is on FC0's Write list but not in §Who owns which file. `firstSeason` and `lastSeason` are 8-digit season IDs, which FV7 could not know. FN4 needed a new `Poster.tsx` to keep the page a server component. FS2 bundles with Rolldown, because `Bun.build` breaks `@antv/g2` and Vite goes at FN6. G6's GPU layouts need `@antv/layout-gpu`, which is not installed, so FR3 uses a CPU layout.
7. **Numbers for FJ1 so far.** Frame bundle: 3.06 MB raw, 0.88 MB gzipped, 7 scripts. G2 adds about 391 kB gzipped to a page and G6 about 497 kB (lab pages, worker-measured). Decoding a 500,000-row table in the frame takes about half a second.
8. **Gates.** Run: FT7, FN7, FV8, FV11 (see §Results). Not run: FR5 (Ben's browsers), FE4 (needs Ben's go-ahead). The real snapshot used is 4b755090e186, found in an older worktree; there is no `data/history/serving.json` pointer in the repo.
9. **Cutover, for Ben.** The Vercel project is stored as a Vite app; `vercel.json` now sets `"framework": "nextjs"`. The history route has `maxDuration: 60` so that Vercel builds it as its own function; without a differing config Vercel packs every API route into one function and the 82 MB history file ships with all of them.
10. **FZ1 scope.** The enforced zero-runtime build needed changes outside FZ1's Write list, each approved narrowly: a `webpack` version pin, `<T,>` on generic arrows the island build parses as JSX, a `<Theme>` wrap in `ThemePreference.tsx`, one dialog style in `GameBoxscore.tsx`, two `.gitignore` lines, and `turbo.json` outputs. FZ1 came back twice without passing, so its second round ran at Sonnet · xhigh. That round found why G6's React nodes broke inside an island: `@antv/g6-extension-react` loads `react-dom/client` from `node_modules` while an island shares Next's vendored React, and React refuses the mismatch. The fix renders nodes by portal from the island's own `react-dom`.
11. **Frame policy.** The frame page is one inline script allowed by a hash in the page's own policy, plus `blob:` modules. With `script-src 'self'`, posted code could have requested scripts from our origin. Chrome does not recognise the `webrtc` directive; FS6 decides what that means.
12. **FS2 order.** FS2 no longer hooks the frame build into `dev` and `build`; FN6 does, so the frame is never published by the Vite build, which has no sandbox headers.

## Later

Out of scope for this plan. The API contract above is what these will call.

- **Web explorer.** Player search, a player's clubs, rosters, a visible chain with undo, the evidence sheet behind any link, the path view with filters, and the played-against lists. §Frontend fixes the approach and runs a spike; **FJ1** writes these cards.
- **Game.** A daily challenge between two well-known players, move-by-move checking, chain verification and a longest-chain score, and a Finals streak view. It needs a fame floor: the farthest pair is Amos Arbour and Trevor Kuntar, nine hops apart, and nobody can play that.
- **User state.** Accounts, saved chains, and leaderboards, in Postgres (D13).

## Ledger

| ID | Title | Tier | Needs | Branch | PR | Status |
| --- | --- | --- | --- | --- | --- | --- |
| H0 | Land the existing import | Orchestrator | — | `history/h0-land-import` | #58 | in stack |
| K0 | Scaffold `packages/history` | Sonnet · low | H0 | `history/k0-scaffold` | #60 | in stack |
| K1 | Contracts, shapes, and fakes | Sonnet · high | K0 | `history/k1-contracts` | #73 | in stack · Opus ✓ |
| I1 | Import dressed goalies | Sonnet · medium | H0 | `history/i1-import-dressed` | #61 | in stack · gate ✓ (70,641 games, 0 failures) |
| I2 | Dressed goalies in the base build | Sonnet · medium | B1 | `history/i2-dressed-base` | #64 | in stack · gate ✓ (265,104 rows, 0 unlisted) |
| B1 | Carry position and points into the base build | Sonnet · medium | H0 | `history/b1-position-points` | #59 | in stack · gate ✓ |
| B2 | Serving tables | Sonnet · medium | B1 | `history/b2-serving-tables` | #66 | in stack · gate ✓ |
| B3 | Cup Final flags | Haiku · medium | B2 | `history/b3-cup-finals` | #76 | in stack · gate ✓ |
| B4 | Graph arrays | Sonnet · high | B2 | `history/b4-graph-arrays` | #77 | in stack · gate ✓ · Opus ✓ |
| B5 | Goalie-partner spans | Sonnet · medium | B4, I2 | `history/b5-goalie-partners` | #97 | in stack · gate ✓ (5,862 spans, 1,126 pairs) |
| B6 | Opponent arrays | Sonnet · medium | B2 | `history/b6-opponent-arrays` | #78 | in stack · gate ✓ |
| O4 | Survive a game finishing mid-refresh | Sonnet · medium | H0 | `history/o4-refresh-retry` | #62 | in stack |
| Q1 | Graph and links | Sonnet · high | K1 | `history/q1-graph-links` | #79 | in stack · Opus ✓ |
| Q2 | Shortest paths in a fixed order | Sonnet · high | Q1 | `history/q2-shortest-paths` | #82 | in stack · Opus ✓ |
| Q3 | Tied chains and their count | Sonnet · medium | Q2 | `history/q3-tied-chains` | #85 | in stack |
| Q4 | Farthest player | Sonnet · medium | Q2 | `history/q4-farthest` | #84 | in stack |
| Q6 | Finals coverage | Sonnet · medium | Q1 | `history/q6-finals-coverage` | #81 | in stack |
| Q7 | Opponents and the relation mode | Sonnet · high | Q2 | `history/q7-opponents` | #89 | in stack · Opus ✓ after #98 |
| A1 | SQLite store | Sonnet · medium | K1 | `history/a1-sqlite-store` | #80 | in stack |
| A3 | History function and local flag | Sonnet · medium | A1 | `history/a3-history-function` | #83 | in stack |
| V1 | Prove the packaged function reads the file | Sonnet · medium | A3 | `history/v1-packaged-sqlite` | #87 | in stack · vercel build ✓ (deploy unproven) |
| A2a | Lookup handlers | Sonnet · medium | A3, Q1 | `history/a2a-lookup-handlers` | #88 | in stack |
| A2b | Path handlers | Sonnet · medium | A2a, Q3, Q4 | `history/a2b-path-handlers` | #91 | in stack |
| A2c | Finals handler | Sonnet · medium | A2a, Q6 | `history/a2c-finals-handler` | #92 | in stack |
| A2d | Opponent handlers | Sonnet · medium | A2a, Q7 | `history/a2d-opponent-handlers` | #93 | in stack |
| C1 | Query command | Sonnet · low | A2b, A2c, A2d | `history/c1-query-command` | #99 | in stack · gate ✓ |
| A4 | Fetch the serving file at build | Haiku · medium | V1 | `history/a4-fetch-serving` | #94 | in stack |
| T1 | Reference answers | Codex | H0 | `history/t1-truth` | #72 | in stack · gate ✓ |
| T2 | Full-snapshot acceptance | Sonnet · medium | A2b, A2c, A2d, B3, B5, B6, T1 | `history/t2-acceptance` | #100 | in stack · gate ✓ ACCEPTED |
| O1 | Run the history checks on pull requests | Haiku · low | K0 | `history/o1-history-ci` | #63 | in stack |
| O2 | Archive manifest and fetch | Sonnet · medium | I1 | `history/o2-archive-manifest` | #65 | in stack · release awaits Ben |
| O3 | Nightly refresh | Sonnet · medium | O2, O4, I2, A4, T2 | `history/o3-nightly-refresh` | #102 | in stack · first run awaits Ben |

Review follow-ups (Codex reviewed every PR; Opus reviewed K1, B4, Q1, Q2, Q7):

| PR | Fixes | Branch |
| --- | --- | --- |
| #96 | O1 CI triggers; O2 cutoff, inventory, path checks | `history/fix-ci-archive-review` |
| #98 | Q7 tied chains and counts for opponent relations | `history/q7b-relation-counts` |
| #101 | B1 schema init; I1 cooldown, refresh nulls, no-op writes; O4 opt-in retry; I2 partition scoping | `history/fix-import-build-review` |
| #103 | B2 points, snapshot transaction, 403 s → 85 s build; B3 in-progress Final; B4 temp spans; T1 evidence | `history/fix-serving-review` |
| #104 | K1 shared games per span kind; roster link rule; Q1 ID-only exports | `history/fix-contracts-review` |
| #105 | V1/A4 Turbo cache drop of the database (P1); stale file; packaging check without a snapshot | `history/fix-packaging-review` |
| #106 | I2 schema v4; O2 interrupted checkpoints and catalog checks | `history/fix-archive-review` |
| #107 | Q3/Q7 counting only along the start's chains (3.5 → 1.1 ms); store closes on dispose | `history/fix-path-count-perf` |
