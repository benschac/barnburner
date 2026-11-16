# RinkSide analyst agent: spec

Status: proposal, Nov 16 2026. Owner: Ben.

## Goal

An agent that reads the saved season data, finds non-obvious facts about a team, and publishes them as "insight cards" on the poster. Every number on a card must come from a query result that a verifier can rerun. A human approves each card before it ships.

Non-goals for v1: live chat on the public site, fetching anything from NHL feeds, editing existing data files.

## Constraints from the current data

- `data/nhl-20262027.json`: 1,344 games, 325 finals (as of the last refresh). Results only: score, decision (REG/OT/SO). No periods.
- `data/boxscores/20262027/<gameId>.json`: 139 files. Per-player skater stats (G, A, P, +/-, PIM, hits, PPG, SOG, FO%, TOI, blocks, shifts, giveaways, takeaways) and goalie stats. **No goal events, no period scores.**
- `data/nhl-poster-20262027.json`: standings, standings history by date, club stats, leaders.
- Box-score coverage is partial (about 43%). Any claim that uses box scores must state its coverage ("in 9 of 14 archived games"), or it fails verification.
- Claims that need period or event data ("when leading after two") are out of scope until a play-by-play feed is added. The agent must decline them and not estimate.

## Architecture

```
refresh (existing) -> build views -> generate (agent) -> verify (code) -> rank (LLM judge) -> pending cards -> PR review -> poster
                                                             ^
                              rerun approved cards after every refresh (staleness)
```

### Package layout

```
packages/analyst/
  src/views.sql          # DuckDB views over data/ (games, team_games, skater_games, goalie_games, standings_daily)
  src/sandbox.ts         # create sandbox, mount data/ read-only, install duckdb, load views
  src/tools.ts           # bash, sql, read_file, submit_card
  src/schema.ts          # InsightCard, EvidenceQuery (Effect Schema, shared with packages/season)
  src/generate.ts        # agent loop per team
  src/verify.ts          # deterministic rerun + binding check
  src/rank.ts            # judge: novelty vs poster, triviality, dedupe
  src/trace.ts           # JSONL run traces
evals/
  qa/*.yaml              # question, ground_truth_sql or ts fn, expected, tolerance
  run.ts
scripts/generate-insights.ts
data/insights/20262027/<TEAM>.json
```

### Runtime

- Model calls: Vercel AI SDK (`generateText` with tools, `stopWhen` step cap). Wrap at the boundary in an Effect service so the rest of the repo stays Effect-native.
- Execution: Vercel Sandbox. Copy `data/` in read-only, preinstall `duckdb` and `jq`, load `views.sql` at startup. Snapshot the prepared sandbox to keep cold starts fast.
- Local dev: same image through the sandbox SDK; no host filesystem access.

### Views (deterministic, reviewed by hand)

`views.sql` is the single source of truth for derived tables. Ground truth for evals uses these same views, written by a human, so the agent is graded against SQL it did not write.

- `team_games(team, game_id, date, home, opp, gf, ga, result, decision, is_final)`: one row per team per game.
- `skater_games(game_id, team, player_id, name, pos, g, a, p, sog, toi_sec, ...)`: archived games only.
- `goalie_games(...)`: archived games only.
- `boxscore_coverage(team, finals, archived)`.
- `standings_daily(date, team, points, rank_div, rank_conf, wc_rank)`.

### Tools

| Tool | Input | Output | Notes |
| --- | --- | --- | --- |
| `sql` | `{ query }` | rows (cap 200) + row count | DuckDB, read-only connection, 10s timeout |
| `bash` | `{ cmd }` | stdout/stderr (cap 8 KB) | For `ls`, `jq`, `head` exploration |
| `read_file` | `{ path, range? }` | text | Paths under `/data` only |
| `submit_card` | `InsightCard` draft | ok or validation errors | Ends that card; agent may submit up to N |

Tool errors go back to the model as text. Retry policy: 3 consecutive failed tool calls ends the run for that team with a logged failure.

### InsightCard schema

```ts
InsightCard = {
  id: string                    // hash(team, query, template)
  team: TeamCode
  status: 'pending' | 'approved' | 'rejected' | 'stale'
  headline: string              // template, e.g. "{wins}-{losses} in one-goal games"
  body: string                  // template, may reference bound values
  bindings: Record<string, { column: string; row: number }>   // every {placeholder} maps to a result cell
  evidence: {
    query: string               // SQL against views
    result: Row[]               // as captured at generation
    gameIds: number[]           // games the claim rests on, for the source drawer
    coverage?: { archived: number; finals: number }   // required if query touches skater/goalie views
  }
  assert?: string               // SQL returning a single boolean that must stay true (e.g. "unbeaten")
  asOf: { fetchedAt: string; completedGameIds: number }
  model: string
  runId: string
  review?: { by: 'ben'; at: string; reason?: RejectReason }
}
RejectReason = 'wrong' | 'trivial' | 'already_on_poster' | 'misleading' | 'bad_copy' | 'other'
```

Key rule: **numbers are never written by the model as text.** Headline and body are templates. Rendering fills placeholders from `evidence.result` through `bindings`. A card with a literal digit outside a placeholder fails verification (dates and jersey numbers go through bindings too).

## Pipeline steps

1. **Generate** (per team): system prompt with the view schemas, coverage table, poster contents (so it avoids repeats), and the out-of-scope list. Ask for up to 6 candidate cards. Step cap 25.
2. **Verify** (code, no model): fresh sandbox, rerun `query`, deep-equal against `result`, check every placeholder resolves, check coverage present when required, check `gameIds` exist and are final, run `assert` if present. Fail means drop and log reason.
3. **Rank** (LLM judge, structured output): score novelty (not already on the poster), specificity, and readability. Keep the top 3. Dedupe by `id` and by near-identical headline.
4. **Write**: merge into `data/insights/20262027/<TEAM>.json` as `pending`. Never overwrite `approved` or `rejected` cards.
5. **Review (v1)**: the workflow opens a PR titled `insights: <date>`. Approving means flipping `status` to `approved` in the diff, or running `bun run insights:review` (a small CLI that prints each pending card rendered with its query and asks a/r/e). Rejections record a `RejectReason`.
6. **Staleness**: after every `data:refresh:all`, rerun verify on approved cards. If the result changed and `assert` still holds, re-render with new values and keep it approved. If `assert` fails or the query errors, set `stale` and hide it.

## Web

- Add `insights` to the `GetTeamData` payload (approved cards only). Validate with the shared schema.
- New poster section "Notes" with up to 3 cards.
- Each card has a "Source" control that opens a drawer showing the query, the result table, and the linked games. Each game opens the existing Box score drawer (`GetGameBoxscore`), so attribution reuses existing UI.

## Evals

Run with `bun run evals`. Not nightly (cost); run on prompt, tool, or view changes and record the results in `evals/results/<date>.json`.

1. **QA accuracy** (about 50 cases): question plus human-written ground-truth SQL. Grade on numeric exact match (with tolerance for percentages). Include:
   - easy lookups ("NJD record at home")
   - multi-step ("points pace over the last 10 vs the first 10")
   - coverage traps ("Hughes points per game": must report archived-game coverage)
   - unanswerable ("goals in the third period": must decline)
2. **Card verification pass rate**: share of generated cards that pass verify, per prompt version.
3. **Human approval rate**: from `review` fields. Rejection reasons are the labeled failure set; add a QA case for every `wrong` rejection.
4. **Cost and latency**: tokens, tool calls, and wall time per team, from traces.

## Observability

`trace.ts` writes one JSONL file per run to `.audit/agent-runs/<runId>.jsonl`: model calls (tokens, latency), tool calls (input, truncated output, duration, error), verify results, final cards. `bun run insights:report <runId>` prints a summary. Keep traces out of git; upload them as a workflow artifact.

## Phases

- **P0 (weekend 1)**: `views.sql`, sandbox, `sql`/`bash` tools, a `bun run ask "<question>" --team NJD` CLI, and 20 eval cases. Exit: the eval runner reports a score.
- **P1 (weekend 2)**: InsightCard schema, generate, verify, rank, the review CLI, and the PR step in the workflow (behind `INSIGHTS_ENABLED`). Exit: one real PR with pending cards for all 32 teams.
- **P2**: Poster "Notes" section, source drawer, staleness recheck. Exit: approved cards live on rinkside.xyz and survive a refresh.
- **P3 (optional)**: live "Ask" box with streaming, per-IP rate limit, cached answers, same tools and verifier, answers show their query.

## Open decisions

- Model choice for generate vs rank (a cheaper model for rank is likely fine; measure it with the evals).
- Whether to backfill the remaining box scores first. Higher coverage makes player cards much more useful.
- Whether review moves from PR diffs to a small authenticated `/review` page in P2.
- Data rights: same open question as `docs/nhl-ingestion-framework-evaluation.md`; deriving and publishing short stat claims should be confirmed against the source's terms.

## Writeup to produce at the end

What failed and how it was caught: verification drop reasons by category, the rejection taxonomy, eval score by prompt version, and one or two concrete bugs (for example, a coverage omission or a bound value that drifted after a refresh).
