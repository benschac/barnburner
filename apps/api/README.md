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
- `src/main.ts` composes the routes, snapshots, and official `NodeHttpServer`
  adapter. `NodeRuntime` owns process signals and scoped shutdown.
- The browser's `SeasonSource` adapter owns a scoped HTTP RPC client, JSON
  serialization, and transport-error mapping. The state machine owns selection
  and retry behavior. Cancelling a load interrupts its network request.

This applies Ratstack's [shared-contract](https://ratstack.sh/skills/add-a-capability)
and [responsibility-boundary](https://ratstack.sh/skills/uncomplect) patterns without
adding its generic capability framework or changing the React/Tamagui client.
The API serves local snapshots and makes no upstream NHL requests or writes.

Run `bun run test:api` for real Node RPC success, declared and transport failures,
and client/server interruption checks. `bun run test:data` covers retained GET
behavior and data validation. `bun run typecheck` checks the shared handler/client
contract; `bun run lint` also rejects browser imports of API implementations.
