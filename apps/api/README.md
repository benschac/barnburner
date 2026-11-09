# Snapshot API

Run `bun run data:serve` from the repository root. Node.js 24 is used in CI.
The listener defaults to `127.0.0.1:3001`. Pass `--host`, `--port`, `--snapshot`,
and `--poster-snapshot` after `--` to override defaults.

The server follows the Layer composition used by the local `meeeeed` project's
`apps/api/src/organizer/local.ts`, adapted to this project's pinned Effect 4.1.2:

- `packages/season` owns shared response schemas, domain calculations, and the
  `GetTeamData` RPC contract. It imports no server implementation.
- `src/snapshots.ts` reads and validates saved JSON once at startup. Invalid files
  fail startup. A missing poster file is allowed, with a typed load failure.
- `src/routes.ts` binds the RPC handler and retains the read-only GET endpoints.
  RPC request bodies are limited to 8 KiB, including chunked requests; larger
  bodies receive HTTP 413. The current zero-field call measured 159 bytes.
- `src/main.ts` composes the routes, snapshots, and official `NodeHttpServer`
  adapter. `NodeRuntime` owns process signals and scoped shutdown.
- The browser's `SeasonSource` adapter owns a scoped HTTP RPC client, JSON
  serialization, and transport-error mapping. The state machine owns selection
  and retry behavior. Cancelling a load interrupts its network request.

This applies Ratstack's [shared-contract](https://ratstack.sh/skills/add-a-capability)
and [responsibility-boundary](https://ratstack.sh/skills/uncomplect) patterns without
adding its generic capability framework or changing the React/Tamagui client.
The API serves local snapshots and makes no upstream NHL requests or writes.

## Vercel

The existing Vercel project uses `apps/web` as its root. The API entrypoints in
`apps/web/api` export the same Effect router as a Web handler for each public route.
The web build first bundles `src/web-handler.ts` into `dist/web-handler.js`,
including the snapshot JSON and shared contracts. This gives Vercel executable
JavaScript without depending on source TypeScript exports at runtime.

The function serves `/api/rpc` and the existing GET routes. Its runtime is reused
across requests; each request retains Effect's scoped lifetime and body limit.
`apps/web/vercel.json` enables request cancellation. Snapshot refreshes become
visible in production after a new deployment, with no local API process required.

Before publishing, run a local `vercel build --prod --standalone` with the
project's settings, inspect the generated function and routes, and exercise that
packaged handler. From the repository root, run
`node apps/web/scripts/check-vercel-output.mjs .vercel/output` with the build's
output path. This copies each function outside the checkout and verifies typed
RPC and all three GET endpoints. Source tests alone do not verify Vercel's package
layout.

Run `bun run test:api` for real Node RPC success, declared and transport failures,
and client/server interruption checks. `bun run test:data` covers retained GET
behavior and data validation. `bun run typecheck` checks the shared handler/client
contract; `bun run lint` also rejects browser imports of API implementations.
