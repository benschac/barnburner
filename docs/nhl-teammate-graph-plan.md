# NHL teammate graph: implementation plan

Status: ready to start, Nov 17 2026. Owner: Ben.

Build a graph of everyone credited with playing in the NHL. A fan should be able to start at Connor McDavid, open one of his Edmonton rosters, follow a teammate to another club or era, and eventually reach Ted Lindsay. Every hop should answer “when did these two play together?” with a team and a specific game.

The import exists locally and reconciles. Everything else here is planned. This revision records the review of Nov 17: it fixes the engine choice, closes the holes the review found, adds goalie partners and “played against”, and splits the work into small PRs. Scope, agreed Nov 17: the data structure, the backend, and the core queries. The web explorer and the game come later (§Later).

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
| D2 | **Three kinds of link.** *Played with*: both have a games-played credit for the same team in the same game. *Goalie partners*: both goalies are on the same team's box score for the same game and at least one has no credit in it, usually the dressed backup. *Played against*: credited on opposite sides of the same game. A chain uses the first two, so every teammate hop has a game behind it. | Ben's call, Nov 17: two goalies on the roster for a game have played together, and opponents should be shown too. Only players with at least one credited NHL game are in the graph, so an emergency backup who never played is not. |
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

## Later

Out of scope for this plan. The API contract above is what these will call.

- **Web explorer.** Player search, a player's clubs, rosters, a visible chain with undo, the evidence sheet behind any link, the path view with filters, and the played-against lists.
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
