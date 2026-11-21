# NHL Data Health — Executor app

Standalone private Executor app, outside the Bun workspace list. This app does not change the website, NHL sources, or the repository's data pipeline.

- **Check now** GETs two fixed public NHL URLs, validates their shapes, and saves both observations atomically to app-owned SQLite. No credentials or schedules.
- Standings use each team's `date`, never `standingsDateTimeUtc` (which may be response generation time). Today/yesterday in America/New_York is recent; older is stale. This is an explicit monitoring policy, not an NHL SLA. Offseason snapshots can be old without a feed outage. Missing, mixed, invalid, or future dates are unknown. A recent date does not establish statistical completeness.
- Scores expose `currentDate`, a game date, not an update timestamp. The app records the date and game count, but always labels score freshness unknown.
- Results are historical observations at check time, not a continuously updating health signal. Click again to obtain a new observation.
- `checkNow` is the sole history writer. UI and MCP share that operation. History reads the newest 100 observations using an index; older records remain stored. No raw bodies, credentials, or exception text are saved. Executor controls access to this app; all authorized users of this installed app share its history.
- Cancellation propagates; a storage failure is not reported as a saved check. There are no automatic retries. A lost response can mean the check saved: read history before manually repeating it. The host/caller bounds network execution.

## Local verification

Requires Bun, npm, and the repository's oxlint. Install dependencies only here:

```sh
npm install --ignore-scripts --no-package-lock --workspaces=false
bun run typecheck
bun run lint
bun test
```

The SQLite tests use Bun's SQLite with a thin adapter for Executor's SQL contract. They do not establish deployed Cloudflare runtime or authenticated UI behavior.

## Deployment

Source entry: `index.ts`; UI: `ui/index.html`; migration: `migrations/0001_checks.sql`. The framework is pinned to the verified host release `apps@0.0.1-beta.143`. Use Executor's create/commit/deploy flow after deployment authorization. Send only runtime files (`index.ts`, `health.ts`, `schema.ts`, `package.json`, `migrations/`, and `ui/`), excluding dependencies, tests and this README. Then use `appUi.location` to obtain the private URL, exercise Check now, reload the authenticated page, and verify that the same history remains. Publishing to Executor's public catalog is a separate action and is not needed.
