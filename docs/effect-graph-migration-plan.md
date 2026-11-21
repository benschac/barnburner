# Effect Graph migration plan

Status: proposed implementation plan; inventory and small feasibility probes complete. No runtime migration has been implemented.

Revised 2026-11-20 after review: the consumer facade now comes before the engine swap, the full-data gate starts immediately in parallel instead of after the test baseline, the consumer inventory is corrected, and the work is split into model-tagged task cards for one Graphite stack. The original EG1–EG6 numbering survives only as a mapping in the ledger.

Revised again 2026-11-20 after the performance investigation and the user's decision: the migration stays a full move to Effect Graph, and opponent distances are computed once per snapshot at build time and stored in the serving file, so the serving runtime never builds the opponent graph.

Audited on 2026-11-20 at repository commit `131954b`, against installed `effect@4.1.2`. Revalidate the inventory if the checkout changes before implementation. Existing unrelated working-tree changes are outside this plan.

## Goal and completion criteria

Use Effect's public Graph API for the general graph machinery we currently maintain: topology, adjacency lookup, breadth-first distances, bounded path walking, component detection, and induced subgraphs. Preserve the NHL domain rules and every public result, error, and evidence contract.

Completion means the serving runtime and its consumers use one graph implementation, the replaced helpers are deleted, existing behavioral tests still pass, and the replacement passes full-snapshot correctness and performance evaluation. A thin Effect wrapper around an otherwise unchanged custom engine does not complete this plan.

The migration does not require a dependency addition, Effect upgrade, graph database, wire-format change, Python-to-TypeScript port, or renderer replacement. It does add one table of precomputed opponent distances to the serving file and one build step that writes it (M3); existing tables and packed bytes are unchanged. It does not authorize publication or deployment.

## Evidence and scope of the traversal

The audit searched graph and traversal terms across application, package, script, test, and workflow sources, then followed imports and direct accesses to `GraphArrays`, `TeammateGraph`, `graph.adjacency`, `makeGraph`, `findPaths`, `farthest`, and the visualization table builders. Graph-shaped rendering code and independent reference algorithms were classified rather than assumed to be migration targets.

Local API references are [the Effect module index](../.agent-sources/effect/index.md), `node_modules/effect/dist/Graph.d.ts`, `node_modules/effect/src/Graph.ts`, `node_modules/effect/src/internal/graph.ts`, and `node_modules/effect/src/internal/graphCsr.ts`. The internal files explain costs; implementation must use public exports only. Graph is marked unstable in the installed declarations, so behavior and ordering tests remain important on future upgrades.

Evidence already gathered in this thread:

- The history workspace suite passed: 89 tests, zero failures. These tests explicitly cover ranked paths, evidence, filtering, mixed relations, and inclusive count caps.
- A temporary C-mini probe compared Effect distances with our BFS for all ten sources under two filters: 200 source/target comparisons, zero mismatches.
- Direct `allShortestPaths` matched the mini-fixture's reachable path sets but failed a deliberately reordered diamond's domain ranking. Sorting only the returned limited paths would select the wrong top N.
- A second temporary probe used an eight-node, multi-level shortest-path DAG with deliberately reversed input order. `simplePaths` preserved descending games, ascending player-ID ties, and the limit-one prefix. A `topo`-driven count returned exact/capped results at caps 5, 4, and 3 for four paths. Off-path and disconnected nodes were excluded.

- A synthetic cost probe (2026-11-20, Node, 8,842 nodes, random unique edges, payload = edge number) compared `Graph.undirected` plus `unweightedDistances` with a typed-array CSR and BFS on the same edges:

  | Size | Effect build | First traversal | Warm full sweep, Effect vs typed-array | Memory after build |
  | --- | --- | --- | --- | --- |
  | Teammate-sized, 480,000 edges | 171 ms | 100 ms | 1.8 ms vs 1.15 ms | +60 MB heap, +94 MB RSS |
  | `either`-sized, 3,750,000 edges | 1.9 s | about 1 s | 9.4 ms vs 8.2 ms | +450 MB heap, +724 MB RSS |

  The first traversal on each new graph pays for Effect's lazy internal index. `unweightedDistances` returns a `Map`.

The probes were read-only and are not committed regression tests. Wave 0 below turns their distinguishing cases into durable tests. They establish feasibility, not full-scale performance or complete behavioral equivalence. The cost probe is a random graph on one machine, not the real snapshot; it sets expectations for gate G1 and does not replace it.

### Expected performance impact

The migration is not performance-neutral. What the cost probe predicts, to be confirmed or refuted by G1 on real bytes:

| Workload | Today | Naive Effect port | With the mitigations below |
| --- | --- | --- | --- |
| Warm default-filter path query | about 1 ms, stops early | 2–4 ms, two full sweeps | 2–4 ms; no early exit is available |
| Filtered path query | 0.2–8 ms | 10–460 ms, proportional to passing links | about 25–70 ms typical, about 115 ms worst seen, plus one typed scan per filter |
| Filtered `farthest`, acceptance sweep | one typed sweep | a full projection per call | first call per filter pays the projection (10–460 ms), then warm |
| `against` / `either` path query | 29 ms build once, then about 8 ms | 3–5 s and 0.5–0.7 GB per relation on first use | about 11 ms typical, about 100 ms worst seen; no graph build at runtime |
| Snapshot build | unchanged | unchanged | about 3–5 minutes longer, and a larger serving file (size unmeasured) |
| Cold start, teammate topology | about 15 ms | 0.2–0.6 s | unchanged; paid once per instance on first use |

Nothing gets faster. The mitigations turn the two large regressions into a bounded one (filtered queries) and a build-time one (opponents). All numbers are synthetic and noisy (single machine, timings varied up to 2x between runs); G1 replaces them.

### Performance mitigations

Investigated 2026-11-20 by reading `node_modules/effect/src/Graph.ts` and `internal/graphCsr.ts` and benchmarking public APIs only, on a season-structured synthetic league (11,353 players, 513,771 links, 1,652,040 spans, rosters persisting year to year) and a random 3,270,000-edge opponent graph.

**Where the cost is.** Effect's algorithms (`unweightedDistances`, `dijkstra`, `simplePaths`) do not walk the `Map`-based graph. They run on a typed-array index built lazily on the first algorithm call and cached per graph object, which is why warm traversal is near parity. The cost is creating a graph object: about 0.6–0.8 µs per edge for build plus first-use index, and roughly 110–200 bytes per edge resident. The design rule follows: build few graphs, keep them for the snapshot's lifetime, and make every request-local graph small.

**What did not help.** `fromSnapshot`, a directed graph traversed with `direction: "undirected"`, and compact node sets all stay within noise of plain `addEdge` for a full-size projection. `Graph.mutate` with `filterEdges` on the cached base is worse (240–785 ms) because it clones every map and then removes edges one at a time.

**M1 — pruned projection for filtered path queries.** `dijkstra` accepts a cost callback and treats `Infinity` as impassable, so it answers a filtered distance on the cached base graph with no projection. That distance bounds a small exact projection:

1. Compute a pass bitmap for the filter: one typed scan over links and spans. This is span filtering, not traversal.
2. `Graph.dijkstra(base, { source, target, cost })` with cost 1 for a passing link and `Infinity` otherwise. `Option.none` is `NoPath`; otherwise the result's distance is the filtered distance `D`. It stops at the target.
3. `Graph.unweightedDistances(base, source)` and `(base, target)` on the cached, unfiltered base graph.
4. Keep players whose unfiltered distances satisfy `fromSource + toTarget <= D`, and passing links with both endpoints kept. Build the request-local undirected graph from only those.
5. Continue with the ranked pipeline (distances, DAG, `simplePaths`, `topo` count) on that small graph.

This is exact, not a heuristic. Removing links can only lengthen distances, so the unfiltered distance is a lower bound on the filtered one; every player on a filtered shortest chain therefore satisfies step 4, and the small graph contains every filtered shortest chain and no chain that the filter forbids. Measured over 7 filters × 40 player pairs: 0 mismatches in distance or tied-chain count against the typed-array engine in 280 queries; median 20–34 ms and worst 115 ms excluding the bitmap, which added 3–57 ms per filter. The projection held a median of 7 to 1,937 links for six filters and 35,640 for the worst one (a three-season window, where the filter raised the distance for 32 of 40 pairs and the prune loosens). A full projection of the same graphs cost 10–460 ms.

**M2 — bounded projection cache for whole-graph filtered work.** Filtered `farthest` and the acceptance diameter sweep need distances to every player, so pruning does not apply and they need a full projection. Its cost is proportional to passing links: about 10–25 ms for one season (23,000 links), 55–80 ms for a decade (119,000), 260–460 ms above 350,000. Hold these in an Effect `Cache` (`Cache.make({ capacity, lookup, timeToLive })`) owned by the loaded snapshot and keyed by the canonical filter, so the first call per filter pays and later calls are warm, and the capacity bounds memory at about 60–95 MB per full-size entry. The acceptance sweep takes its partners-off projection from the same cache once. Capacity and TTL are G2 decisions.

**M3 — opponent distances computed at build time.** `against` and `either` accept only the default filter, so each has exactly one graph per snapshot and its distances never change. Compute them when the snapshot is built and ship them:

1. _Build step._ After the serving build and before acceptance, a Node/Effect script opens the serving file, builds the `against` graph and the `either` graph (teammate links plus opponent pairs, one logical edge per pair) with Effect, runs `Graph.unweightedDistances` from every player, and writes one distance row per player and relation: a byte per player, 255 for unreachable. About 5 s and 0.5 GB per graph plus 8,842 sweeps at 9–15 ms each, so roughly 3–5 minutes in CI in total. The Python builders stay standard-library only; a pure-Python equivalent would take hours.
2. _Runtime._ A query reads the two rows for its endpoints. `rowSource[target]` is the distance `D`, or `NoPath`. The players on a shortest chain are exactly those with `rowSource[v] + rowTarget[v] === D`, and an arc `u → v` exists when the pair is linked and `rowTarget[v] === rowTarget[u] - 1`. One scan of the packed opponent pairs (and teammate links for `either`) yields the arcs. No opponent graph object exists in the serving process.
3. _Storage._ Raw rows are 78 MB per relation. Distances are small, so packing or per-row compression should cut that several-fold; G1 measures the real size and picks the encoding. A missing table means `HistoryUnavailable` for `against`/`either` only, as missing opponent arrays do today.
4. _Independence._ The Python truth file gains sampled `against` and `either` distances from its own search, and acceptance compares them with the stored rows.

Prototyped on an era-banded synthetic opponent relation (8,842 players, 3,270,000 pairs, distances up to 7) with the rows produced by a stand-in search: 0 mismatches in capped count or in the first ten ranked chains across 60 queries; median 10.7 ms, p95 63 ms, worst 100 ms. Pair `link` and the `opponents` listing keep reading packed arrays.

**M5 — never materialize a large shortest-path graph.** Distant pairs in a dense relation tie on enormous numbers of chains: the prototype saw up to 4,029 on-path players and 537,019 arcs, and building that as an Effect graph cost a further 300–470 ms. Two rules avoid it, and both were checked against the full graph in the prototype:

- _Count without a graph._ Fold the arc list in descending distance-to-target order with saturating addition. The distance layers already are a topological order, so `Graph.topo` is not needed.
- _List from a trimmed graph._ Every arc in a shortest-path graph leads to the target, so the first `limit` chains in depth-first order never use more than a player's first `limit` arcs in D6 order. Build the Effect DAG from those arcs only, reached from the source, and run `simplePaths` on it. The worst case kept 12,809 arcs of 537,019.

**M4 — small items.** Use the one-sweep DAG variant for default-filter queries. Build the teammate base graph once per snapshot behind the existing `Effect.cached`, optionally started at store open instead of on the first query. Precompute per-link season and kind summaries if the pass bitmap proves material on real data.

**Residual costs to decide at G2.** No early exit on default queries (a few milliseconds). Filtered path queries at tens of milliseconds instead of about one. The first filtered `farthest` per filter at up to about half a second. A longer snapshot build and a larger serving file, whose packaged size must stay inside the deployment limit. If the stored rows fail that limit even when packed, the fallback is a recorded exception keeping `against`/`either` traversal on packed arrays, not a redesign of the rest.

## System of record and data flow

```text
NHL archives / dressed-goalie facts
  -> Python base build -> base SQLite
  -> serving SQL derivation -> packed serving SQLite
  -> opponent-distance build step (Effect) -> distance rows added to the serving SQLite
  -> history-store.ts -> validated GraphArrays + snapshot identity
  -> history runtime -> Effect topology + query projections
  -> domain results -> RPC / CLI / visualization tables
  -> browser atoms / G6 / sandbox

base SQLite -> independent Python truth -> acceptance comparison
```

The Python builders remain the writers of durable facts and packed arrays. The opponent-distance build step is a second, deterministic writer of one derived table, run before acceptance and before the published hash is taken; the rows are a cache of what the packed pairs already imply, checked against the independent truth file. The API store remains the reader and validator of the serving artifact. Effect graphs are disposable projections owned by one loaded history snapshot; they are never a second persisted source of truth. Request-specific filtered graphs and shortest-path DAGs are derived from that snapshot.

## Complete change inventory

### Producers, persistence, and oracle

| Owning files | Responsibility | Treatment |
| --- | --- | --- |
| `scripts/import-nhl-history.py`, `import-nhl-dressed.py`, `check_nhl_history.py`, `nhl-history-archive.py` | Source capture, reconciliation, archive manifests | Keep; not graph traversal |
| `scripts/build-nhl-history.py` | Base SQLite, credited appearances and dressed facts | Keep |
| `scripts/build-nhl-serving.py`, `nhl_serving_tables.py`, `nhl_serving_finals.py` | Transactional serving build, lookup tables, Finals facts | Keep build ordering, deterministic output and atomic replacement |
| `scripts/nhl_serving_graph.py`, `nhl_serving_partners.py` | Derive teammate and goalie-partner spans from game evidence | Keep SQL and domain semantics |
| `scripts/nhl_serving_graph_pack.py`, `nhl_serving_opponents.py` | Pack teammate spans and opponent pairs | Keep disk bytes, sort order, widths and little-endian format |
| `scripts/nhl_history_truth.py` | Independent BFS, counts, components, diameter and evidence from base facts | Deliberately keep independent custom algorithms; do not reuse Effect/runtime code. Add sampled `against` and `either` distances so acceptance can check the stored rows |
| New `apps/api/scripts/history-distances.ts`, `.github/workflows/refresh-nhl-history.yml` | Compute and store opponent distance rows (M3) | New build step between the serving build and acceptance; atomic replacement, deterministic output |
| `apps/api/src/history-store.ts` | Decode blobs, index players, lazy opponent loading, snapshot validation, SQL lookups | Preserve storage boundary and lifetime; no eager opponent materialization. Add lazy per-player reads of the opponent distance rows |
| `packages/history/src/shapes.ts`, `store.ts`, `contracts.ts` | Packed types, store port, domain values, RPC schemas/errors | Keep durable/wire contracts; revise runtime topology types separately |

Packed-format invariants remain: sorted player/season/team IDs; sorted unique pairs with `a < b`; Uint16 player endpoints; Uint32 span offsets with final sentinel; Uint8 season/team/kind/link codes; Uint16 game counts; Uint32 first-game IDs. Opponent arrays carry counts, not seasonal spans. Keep producer limit checks, aligned decode copies, and missing-versus-empty opponent data distinctions.

### Runtime algorithms

| Current owner and helpers | Replacement or retained responsibility |
| --- | --- |
| `packages/history/src/graph.ts`: `buildAdjacency`, `makeGraph` | Build one immutable `Graph.undirected` topology using `addNode` and `addEdge`; remove custom CSR construction |
| `graph.ts`: `linkIdBetween` | `edgesBetween` plus edge payload lookup; enforce one logical teammate edge per pair |
| `graph.ts`: `buildOpponentAdjacency`, `opponentAdjacency`, `opponentGamesBetween`, `opponents` | Lazy Effect opponent topology and public incident-edge/neighbor queries; retain sorted output, game counts and availability semantics; benchmark pair lookup without forcing full opponent topology |
| `graph.ts`: `spanPasses`, `linkPasses`, `linkPassingGames`, `evidenceSpan`, `hopKind`, `passingSpans`, `linkKind`, `link` | Retain/consolidate NHL rules over raw spans. Graph cannot choose an evidence game or define goalie partners |
| `packages/history/src/paths.ts`: `bfsDistances` | `Graph.unweightedDistances` on the query's allowed topology |
| `paths.ts`: `firstStepAt`, `walkFirstPath`, `enumerateBy`, `enumerateChains` | Ranked directed shortest-path DAG plus `Graph.simplePaths`; one path pipeline for limit 1 and larger limits |
| `paths.ts`: `countChainsBy`, `countShortestChains` | Small saturating count fold over the arc list in distance-layer order (M5); remove the handwritten traversal queue |
| `paths.ts`: `teammateHop`, `findPaths` | Keep domain construction, argument validation and result assembly; delegate graph mechanics |
| `packages/history/src/relation-paths.ts`: `relationDistances`, `countRelationChains`, `enumerateRelationChains` | Shared query engine over `against`/`either` topology; delete duplicate search/count/enumeration plumbing |
| `relation-paths.ts`: filter validation, opponent hop construction, `findRelationPaths` | Preserve public behavior, including teammate precedence for a pair present in both relations |
| `packages/history/src/farthest.ts` | Effect distance maps and the same ranked example-path pipeline; retain selection/count rules |
| `packages/history/src/finals.ts`: `sharedGameTeammates` | Effect incident-edge traversal with shared-game-only span aggregation |
| `finals.ts`: `coverFinal`, `finalsCoverage` | Keep eligibility, date-range behavior, selected teammate and evidence rules |
| `packages/history/src/index.ts` | Migrate callers, then remove `Adjacency`/`OpponentAdjacency` exports and obsolete helpers; keep public domain operations |

### Consumers and tooling

| Owning files | Required action |
| --- | --- |
| `apps/api/src/history-routes.ts` | Preserve once-per-store graph construction, scoped lifetime, ten RPCs, pagination, snapshot IDs and failure behavior |
| `history-routes.ts`: `fillOpponentHops` | Keep SQL enrichment of earliest opposed game by date then game ID; runtime node/edge IDs must not become wire evidence |
| `apps/api/scripts/history-query.ts` | Adapt construction/types; preserve CLI flags, resolution of names, output and errors |
| `apps/api/scripts/history-viz-tables.ts` | Adapt construction; retain six table exports, JSON schema, filenames and failure atomicity |
| `apps/api/scripts/history-accept.ts`: `componentCount` | Replace union-find with `Graph.connectedComponents`; include isolated nodes and partner-off topology |
| `history-accept.ts`: `sharedTeammates` | The only CSR read in this file (`history-accept.ts:116`); move it to the facade |
| `history-accept.ts`: `sweepFarthest`, `countLinks` | No CSR read: `countLinks` scans packed arrays and `sweepFarthest` calls `farthest`. Keep as independent checks; no change required |
| `history-accept.ts`: timing | Keep existing timing output; extend evaluation with the benchmark matrix below |
| `packages/viz/src/tables/ego.ts` | Replace the CSR read (`ego.ts:22`) and all-pairs link probing with allowed-neighbor selection and `inducedSubgraph`/edge iteration; retain focus, deterministic IDs and enrichment |
| `packages/viz/src/tables/league.ts` | Out of scope. It reads packed `edgeA`/`edgeB`/span arrays only and never touches CSR; the arrays remain the storage owner, so converting it would add work without removing custom graph code |
| `packages/viz/src/tables/chain.ts`, `pair.ts`, `opponents.ts`, `finals.ts` | Keep public history calls and output schemas; migrate type/construction dependencies as necessary |

### Surfaces audited that should keep their contracts

- **Transport/runtime:** `apps/api/src/history-handler.ts`, `main.ts`, `apps/api/scripts/build.mjs`, and `apps/web/app/api/history/route.ts`. The graph stays server-side and the scoped store still closes correctly.
- **Browser state:** `apps/web/src/explorer/history-atoms.ts`, `url-state.ts`. Preserve request shapes, hydration keys, `skipInitialRun`, TTL, refresh behavior and transport-error translation.
- **Visualization inputs:** `packages/viz/src/contracts.ts`, samples, `apps/web/src/viz/chain-file.ts`, `use-chain-file.ts`, `viz/specs/chain.ts`, `viz/lab/entries/chain.tsx`. Retain chain membership, table schemas, labels, selection and highlighting. Display-node deduplication is presentation work, not a replacement target.
- **Rendering:** `apps/web/src/viz/G6Graph.tsx`, `g6-host.ts`, `use-g6-graph.ts`, `viz/frame/*`, and `viz/bench/{harness.ts,stats.ts,renderers/*}`. G6/Cosmos still own layouts, drawing and lifecycle. Browser FPS benchmarks do not measure the server graph engine.
- **Analyst/season:** analyst visualization generation consumes viz contracts; no history graph engine was found in `packages/analyst` or `packages/season`. Preserve their contracts and include them in workspace verification where affected.
- **Fetch/package:** `apps/api/scripts/fetch-history.ts`, `apps/web/next.config.js`, `apps/web/vercel.json`, `apps/web/scripts/check-vercel-output.mjs`, `turbo.json`. Preserve artifact hash/size checks and history-only SQLite packaging.
- **Automation:** `.github/workflows/refresh-nhl-history.yml`, `history-checks.yml`, `workspace-checks.yml`, root/workspace manifests. Keep build → independent truth → acceptance ordering. Local migration does not run release upload or deployment steps.
- **False matches:** Open Graph social metadata, Graphite workflow names, vendored lint tooling and library reference caches are outside the application graph migration.

## Architecture choice

### Shapes considered

1. **Keep CSR as the runtime owner and convert to Effect graphs for individual operations.** This is an easy spike, but permanently maintains two topology representations and can repeat full conversion per query. It does not meet the deletion goal. Use only in temporary parity/benchmark tooling.
2. **Effect owns runtime topology; packed arrays retain storage/evidence ownership.** Build teammate topology once, construct opponent topology only when required, and derive bounded-lifetime query projections. All general traversals use Effect. This is the target, subject to the full-data performance gate.

Replacing the packed artifact with a serialized Effect snapshot is not needed for option 2 and would couple persistence to an unstable library API. Do not combine those changes.

### Proposed module boundaries and interfaces

Keep `GraphArrays` and the minimal loaded `Graph` (`arrays`, `indexOf`) as the storage boundary. `TeammateGraph` becomes the runtime wrapper instead of exposing `adjacency`. Alias the library import as `EffectGraph` where needed to distinguish it from the existing storage type.

- **Consumer facade (lands first, on the current CSR):** `graph.ts` exports a small set of packed-index operations, proposed as `teammateLinks(graph, index)` yielding `{ other, linkId }` in ascending player order, and `componentCount(graph, filter)`. `finals.ts`, `ego.ts` and `history-accept.ts` use these instead of `graph.adjacency`; they are the only three readers outside the engine. The engine swap then changes the implementation behind the facade without touching consumers. The facade is the permanent interface, not a compatibility adapter.
- `graph.ts` owns construction, snapshot-scoped topology lifetime, lookup operations and domain span/evidence helpers. If construction makes it too large, extract one `topology.ts`; do not introduce a new package or generic graph service framework.
- `paths.ts` owns the shared query-topology → distances → ranked DAG → count/enumeration pipeline.
- `relation-paths.ts` owns relation policy only, forwarding to the shared engine. If the file is removed, relocate/re-export `findRelationPaths` through the barrel and migrate direct module imports; preserve its default limit of one and its existing packed-player-index input semantics. That exported low-level function is an exception to the player-ID-facing domain operations, not a license to expose Effect node IDs.
- `farthest.ts` and `finals.ts` remain domain operations over this facade.
- Viz consumers use domain-oriented neighbor/link/league projections exported from history as needed. They must not reach into either custom CSR or Effect's internals.

Sketch of internal values (names are proposed; final declarations must follow the project's Schema/tagged-union rules):

| Value | Shape and owner |
| --- | --- |
| Teammate topology | `EffectGraph.UndirectedGraph<PlayerId, LinkId>`; edge payload is the packed link ID, not a copied span collection |
| Opponent distance rows | Stored per player and relation (`against`, `either`), a byte per player, read lazily two rows per query through the store port. No opponent graph object at runtime (M3) |
| Filtered projection cache | Effect `Cache` of full filtered projections keyed by canonical filter, bounded capacity, owned by the snapshot (M2) |
| Query topology | Allowed edges for one validated filter/relation; payload carries the chosen relation reference and games used for ranking |
| Shortest-path DAG | Directed player graph containing only source-to-target shortest-path nodes/arcs; payload retains the original relation reference |
| ID maps | Explicit player ID ↔ Effect node index mapping for each topology; packed `indexOf` still addresses arrays |

Capture IDs returned by `addNode`/`addEdge`. Never assume an Effect node index is an NHL player ID, a packed player index, or an index retained by a transformed graph. `neighborhood` reallocates identifiers; `inducedSubgraph` preserves identifiers. Read payloads or rebuild mappings deliberately. Include all players, even isolated ones, when constructing a base/query topology.

The existing domain entry points (`makeGraph`, `link`, `linkKind`, `opponents`, `findPaths`, `findRelationPaths`, `farthest`, `finalsCoverage`) retain their observable contracts. Internal type changes must be applied to every inventoried caller in the same implementation unit. Raw Effect graphs never cross RPC/JSON boundaries.

### Filtering, relation composition and lifetime

- Teammate filters remain competition, inclusive season bounds, and goalie-partner inclusion. The default includes goalie partners.
- `unweightedDistances` has no edge predicate; construct an allowed topology before traversal. Validate filter/relation combinations before creating it.
- `against` and `either` continue rejecting non-default filters because opponent data has no span-level filter evidence.
- For `either`, emit one logical edge per pair. When both relations exist, choose teammate semantics, teammate games and teammate evidence. Do not let Effect multiedges duplicate paths/counts.
- Cache the immutable base topology per loaded snapshot. Keep arbitrary filter projections and source-target DAGs request-local initially; no unbounded filter cache. A full request-local projection costs up to about 460 ms, so it is not used for path queries: filtered path queries use the pruned projection (M1 above), and whole-graph filtered work uses the bounded `Cache` (M2). G1 confirms both on real data.
- Teammate-only queries must not read `oppA`, `oppB`, `oppGames` or the distance rows. Pair-level `link` and the `opponents` listing read the packed opponent pairs directly, as today; that is storage access, not traversal, and stays. `against`/`either` path queries read two distance rows and scan the packed pairs; they never build an opponent graph.
- Snapshot replacement/missing-data failures must not populate a successful cache. Keep store disposal and snapshot identity checks intact.

### Ranked shortest paths without a custom walker

1. Validate endpoint IDs and relation/filter rules with the existing error precedence. Preserve same-player and missing-opponent behavior. Normalize the enumeration limit at the domain boundary: current package calls return at least one chain for limits of zero or negative values, whereas `simplePaths` returns none for zero and rejects negatives. RPC already constrains limits to integers 1–10. Current behavior, read from `paths.ts` and `relation-paths.ts` and to be pinned by executed tests in card 0b: for `with`, any limit of 1 or less returns exactly one chain, a fraction such as 2.5 returns three, `NaN` returns a success with zero paths, and `Infinity` enumerates every tied chain; `against`/`either` apply `Math.max(limit, 1)` with the same fraction, `NaN` and `Infinity` results. Document the supported handling before changing it; do not leak a new thrown `GraphError` through a Result-returning operation.
2. Build/select the allowed undirected query topology: the cached base graph for the default `with` filter and the M1 pruned projection for a filtered `with` query. `against` and `either` build no topology: their distances come from the stored rows (M3), so skip to the arc list in step 5.
3. Use `unweightedDistances` from source and target. An absent target distance becomes `NoPath`, not a library exception. Let the shortest distance be `D`. Alternative to measure in G1: sweep from the target only, then expand forward from the source along arcs that lower the distance by one. That yields the same DAG with one sweep and touches only on-path nodes, as the current engine does.
4. Keep nodes for which `distanceFromSource + distanceToTarget === D`. This excludes nodes near the target that are not on a shortest path from the source.
5. List the arcs: `u → v` when the pair is linked under the query's relation and filter and `distanceToTarget[v] === distanceToTarget[u] - 1`, for on-path players only. Every arc decreases distance, so the arcs form an acyclic graph whose source-to-target routes all have exactly `D` hops.
6. Count on the arc list, not on a graph (M5): fold the arcs in descending distance-to-target order with saturating addition. Set `pathCountCapped` when the true count is **greater than or equal to** `PATH_COUNT_CAP` (currently 1,000,000). A small output limit must not lower this count.
7. Rank each player's outgoing arcs in D6 order: descending passing games, then ascending destination player ID, using Effect `Order`/`Array` helpers. Build a directed Effect graph from only each player's first `limit` arcs, starting at the source and following kept arcs, inserting them in rank order (M5).
8. Enumerate `Graph.simplePaths(dag, { source, target, limit })` with the normalized limit from step 1. Its documented depth-first edge order produces the ranked shortest chains. Build domain hops from the edge references. Use this same operation for the first path and farthest-player example.

`simplePaths` is safe to bound here because the constructed graph contains only shortest paths. Do not call it on the entire cyclic NHL graph and then filter by length. Do not replace hop distance with games-based numeric weights: games are a lexicographic tie-break, not an additive shortest-path cost.

Direct `allShortestPaths` is useful as a test comparison but is not the selected ranked enumerator: its bounded output order does not implement D6. Its cost callback can exclude edges with `Infinity`, but that alone does not solve ranked top-N selection or capped counting. There is no public capped-path-count operation in this installed API; the small count fold is intentionally retained domain code. `Graph.topo` over the full DAG gives the same count and was verified on small graphs, but it requires every arc to exist as a graph edge, which M5 rules out for dense relations.

Two distance sweeps and construction of a DAG add work. Benchmark that work explicitly rather than assuming removing custom code makes it faster. Effect's base Maps/edge objects and lazy internal CSR also need memory measurement; public Graph APIs cannot directly wrap our existing packed CSR.

### Other operations

- **Farthest:** maximum finite shortest distance, counts excluding the source, lowest player-ID destination on a tie, and the same D6-ranked example. Preserve the isolated-player result (distance 0, no example).
- **Finals:** shared-game links only; a goalie partner or the player themself cannot create a hit. Preserve most-games/lower-ID selection, first shared evidence, first Final game, inclusive years, and links that predate or postdate the Final.
- **Ego:** select focus plus allowed neighbors, then induced edges among that set. Preserve an isolated focus. Use default-filter semantics, including goalie partners; do not confuse the shared-game-only Finals projection with ego.
- **League:** enumerate every stored teammate link and all its spans, preserving canonical endpoint order and degree counts. It is not a filtered search result.
- **Components:** use `connectedComponents` with all isolated nodes included. Diameter still requires the appropriate distance sweeps; connected components alone do not compute it.
- **Failures:** keep `UnknownPlayer`, `NoPath`, `UnsupportedFilter` and `HistoryUnavailable` distinct. Validate normal caller failures before Graph calls. Graph may throw eagerly or during iterator consumption; handle any expected boundary failure through the project's typed error model and preserve causes. Do not blanket-convert programming defects to `NoPath`.

## Behavioral verification matrix

| Contract | Existing tests | Additional migration proof |
| --- | --- | --- |
| Ordering, shortest distance, first/top-N chains, evidence | `packages/history/tests/paths.test.ts`, `graph.test.ts` | Reverse insertion order; multi-level ties; game totals changed by filters; limits 1/2/10 must be prefixes; direct-call zero/negative limit normalization; characterize fractional/nonfinite inputs; compare complete domain results |
| Saturating count, independent of returned limit | `paths.test.ts` layered graph with over two million paths, exact-cap and below-cap cases | Same tests against DAG fold; no path enumeration to obtain count; exclude off-path nodes |
| Relations, teammate priority, missing opponents | `packages/history/tests/opponents.test.ts` | Explicit one-edge-per-pair assertion; no duplicate chains in `either`; unknown/filter/data error precedence |
| Farthest and Finals | `packages/history/tests/farthest.test.ts`, `finals.test.ts` | Remapped node IDs, multiple farthest ties, unchanged evidence and isolation behavior |
| Packed data, filters, schema round trips | `packages/history/tests/contracts.test.ts`, `graph.test.ts`, `packages/history/tests/fakes.ts` | Sparse/remapped Effect identifiers; payload-to-packed-link round trip; all-pair symmetry |
| Store/snapshot/lifetime | `apps/api/tests/history-store.test.ts`, `history-routes.test.ts` | Repeated calls reuse topology; teammate paths do not trigger opponent getters; failed lazy load is not cached as success |
| RPC and SQL evidence | `apps/api/tests/history-paths.test.ts`, `history-opponents.test.ts`, `history-finals.test.ts` | Exact wire hop order/count/evidence after replacement; earliest opposed-game enrichment unchanged |
| CLI and acceptance | `apps/api/tests/history-query.test.ts`, `history-viz-tables.test.ts`, `history-accept.test.ts` | Components include isolated nodes; same report/diameter semantics; golden deterministic output |
| All six viz table families | `packages/viz/tests/tables-{chain,pair,ego,league,opponents,finals}.test.ts` | Isolated ego focus, triangle induced edge, partner-only links, correct IDs after graph transformations; exact table equality |
| Browser state and display | `apps/web/tests/history-atoms.test.ts`, `url-state.test.ts`, `viz-chain.test.ts` | Keep hydration/no-second-request behavior and chain membership/highlighting inputs |
| Producer/oracle independence | `tests/test_build_nhl_history.py`, `test_build_nhl_serving.py`, `test_nhl_serving_{graph,partners,opponents,finals}.py`, `test_nhl_history_truth.py`, archive/check/import tests | Same packed mini-fixture bytes; full-snapshot independent truth comparison |

Tests that import implementation helpers may move to the new internal module or assert the same property through a public operation. Do not delete their behavior assertions merely because a helper is removed. Add a deterministic small-graph differential corpus before deletion, including permutations of insertion order. Keep golden expected results or the independent oracle afterward; do not ship the old engine as a permanent fallback.

## Full-data and performance gate

Current local inventory: season/dressed archive directories and catalog/totals exist. Archive completeness has not been verified. `data/history/nhl.sqlite`, `nhl-serve.sqlite`, `manifest.json`, `serving.json`, and packaged `apps/web/history-data` were absent at audit time. Therefore no full-data timing, memory, or acceptance result is claimed here.

Historical documentation records 8,842 players, 478,383 shared-game pairs, 1,049,918 shared spans and 3,273,864 opponent pairs; partner-only pairs are additional. These are dated baseline counts, not verified current measurements. Do not use them as a substitute for a matching snapshot and truth file.

Card 0a must acquire or build a validated scratch snapshot and preserve its hash/identity. Gate G1 must run old/new implementations on identical bytes, runtime, host and seeded query corpus. Prefer an offline build after checking archive coverage; do not silently refresh source data during comparison.

Existing commands, with absolute scratch paths substituted:

```sh
python3 scripts/build-nhl-history.py --root data/history --db <scratch-base.sqlite>
python3 scripts/build-nhl-serving.py --base <scratch-base.sqlite> --out <scratch-serving.sqlite>
bun run history:distances -- --db <scratch-serving.sqlite>   # new in card 3b; name proposed
python3 scripts/nhl_history_truth.py --db <scratch-base.sqlite> --out <scratch-truth.json>
bun run history:accept -- --db <scratch-serving.sqlite> --truth <scratch-truth.json>
```

The truth output must be outside `data/history`. Use `--baseline` only for the exact pinned baseline. `--skip-diameter` on truth and acceptance is suitable for iteration but must be reported; it does not fulfill the final diameter check.

The existing acceptance tool measures cold store-open plus `makeGraph`, and median 1,000 seeded default teammate searches with limit 1. It does not enforce a performance threshold. Extend a dedicated benchmark/report to record:

| Workload | Measurements |
| --- | --- |
| Cold open + teammate construction | Wall time, baseline/peak RSS, retained memory after GC where supported |
| First opponent pair lookup vs first opponent traversal | Blob-load cost separately from topology construction, peak and retained memory |
| Warm `with`, `against`, `either` | Median and p95 latency for fixed successful, disconnected and same-player cases; limits 1/2/10 |
| Filter variants | Projection cost plus end-to-end query time for seasons, competition and partners off |
| Ranked DAG/count stress | Two distance sweeps, DAG construction, count and bounded enumeration reported separately |
| Farthest/diameter/components | Individual queries and full acceptance sweep; fixed projection reuse without per-source rebuilds |
| Ego/league tables | Topology extraction and enriched table production measured separately |
| Repeated distinct queries | Retained memory/cache growth and store disposal; no unbounded filter/DAG cache |

Run fresh processes for comparable cold memory measurements; record warm-up, sample counts, runtime versions and snapshot hashes. Ensure correctness results are compared alongside timing, and use no provider calls or LLM generation in the benchmark.

There is no established server-memory or tail-latency budget in the current acceptance tool. Gate G2 must record the measured baseline and proposed acceptance budgets before choosing the production representation. Do not invent a passing threshold after observing the candidate. A material latency/memory tradeoff is an explicit decision with numbers, not an automatic pass or an excuse to silently retain duplicate engines. If the target cannot meet the agreed budget, report the failing workload and revise the design before cutover.

## Sequenced task cards

All cards are pending. Nothing here is implementation approval beyond what the user grants in conversation, and nothing authorizes deployment.

**Shape.** Facade first, engine second: wave 0 locks behavior, wave 1 adds the facade on the current engine, wave 2 moves every consumer and test onto it, and only then does wave 3 swap the engine. Waves 0–2 are worth keeping even if the gate fails. The gate runs in parallel with waves 1–2 because it is the only step that can stop the plan.

**Stack mechanics.** One linear Graphite stack, branches named `eg/<card>-<slug>`. Each worker runs in its own worktree and owns only the files listed on its card. The orchestrator chains finished branches in card order, stages paths explicitly (never `-a`), and submits with `gt submit`. Review fixes are added as further commits on the owning branch. Dispatch never waits for a merge.

**Model and effort.** Each card names the cheapest model expected to get it right. On a failed card raise effort before raising the model.

### Wave 0 — lock behavior and prepare the gate (all parallel, no dependencies)

| Card | Task | Files owned | Model, effort |
| --- | --- | --- | --- |
| 0a | Check archive coverage, build a scratch base and serving snapshot and the independent truth file outside `data/history`, record hashes. No PR | scratch paths only | Haiku, low |
| 0b | Ordering, multi-level ties, limits 1/2/10 as prefixes, filter-changed game totals, and the limit behavior listed in step 1 | `packages/history/tests/paths.test.ts` | Sonnet, medium |
| 0c | One logical edge per pair, no duplicate chains in `either`, unknown/filter/data error precedence | `packages/history/tests/opponents.test.ts` | Sonnet, low |
| 0d | Multiple farthest ties, isolated player, Finals evidence and self/partner exclusion | `packages/history/tests/farthest.test.ts`, `finals.test.ts` | Haiku, medium |
| 0e | Isolated ego focus, triangle induced edge, partner-only links, exact table equality | `packages/viz/tests/tables-ego.test.ts` | Haiku, medium |
| 0f | Repeated calls reuse the graph, teammate paths do not trigger opponent getters, a failed lazy load is not cached as success | `apps/api/tests/history-store.test.ts`, `history-routes.test.ts` | Sonnet, medium |
| 0g | Seeded small-graph differential corpus with insertion-order permutations and golden complete results from the current engine | new files under `packages/history/tests/` | Sonnet, high |
| 0h | Benchmark script for the current engine covering the matrix above; fresh-process memory, median and p95 | new `apps/api/scripts/history-bench.ts` and its test | Sonnet, medium |
| 0i | Truth file gains sampled `against` and `either` distances from an independent search over base facts, with tests | `scripts/nhl_history_truth.py`, `tests/test_nhl_history_truth.py` | Sonnet, medium |

Done: the current implementation passes every new test; a failure identifies a missing test or a real existing bug, never changed semantics.

### Wave 1 — consumer facade on the current engine

| Card | Task | Files owned | Needs | Model, effort |
| --- | --- | --- | --- | --- |
| 1 | Add `teammateLinks` and `componentCount` over the existing CSR and packed spans, with tests; export through the barrel | `packages/history/src/graph.ts`, `index.ts`, `tests/graph.test.ts` (additions only) | none | Sonnet, medium |

### Wave 2 — move consumers and tests onto the facade (all parallel)

| Card | Task | Files owned | Needs | Model, effort |
| --- | --- | --- | --- | --- |
| 2a | `sharedGameTeammates` uses `teammateLinks` | `packages/history/src/finals.ts` | 1 | Haiku, low |
| 2b | Ego uses `teammateLinks` for neighbours and for links among them instead of probing every pair with `link` | `packages/viz/src/tables/ego.ts` | 1, 0e | Sonnet, low |
| 2c | `sharedTeammates` and `componentCount` use the facade; union-find deleted | `apps/api/scripts/history-accept.ts` | 1 | Sonnet, low |
| 2d | Tests stop reading `graph.adjacency`, `bfsDistances`, `countChainsBy`, `linkIdBetween`, `opponentAdjacency`; each assertion is kept through a public operation or the facade | `packages/history/tests/graph.test.ts`, `paths.test.ts`, `opponents.test.ts` | 1, 0b, 0c | Sonnet, medium |

Done: `rg 'graph\.adjacency'` matches only the engine files `graph.ts`, `paths.ts` and `relation-paths.ts`; `Adjacency` is no longer needed by any consumer.

### Gate — full-snapshot proof (parallel with waves 1–2)

| Card | Task | Needs | Owner |
| --- | --- | --- | --- |
| G1 | Effect prototype inside the benchmark only: teammate base graph, M1 pruned projections for filtered `with`, the M2 projection cache, opponent distance rows computed with Effect and their stored size under each candidate encoding (M3), the layer count fold and trimmed DAG (M5), `simplePaths`. Exact result comparison with the old engine and the truth file, then the full matrix. Production entry points unchanged | 0a, 0g, 0h | Opus, high |
| G2 | Set budgets from the baseline numbers before reading the candidate numbers; record go/no-go and the filtered-query, projection-reuse, pair-lookup and opponent-topology decisions in this document | G1 baseline half | user decision, orchestrator records |

Named go/no-go items: filtered path-query latency with M1, including the prune size distribution and the cases where the filter raises the distance; first-call and warm cost of filtered `farthest` with M2, and the cache capacity that memory allows; build time and stored size of the opponent distance rows, and the packaged function size with them included; `against`/`either` query latency from the rows on the real relation, including the largest shortest-path graphs; point-to-point latency without early exit; the all-source diameter sweep on one cached projection. If artifacts are unavailable the gate stays open; mini-fixture success cannot close it. If a workload fails its budget, revise the design here before wave 3.

### Wave 3 — swap the engine behind the facade (sequential, one file set at a time)

| Card | Task | Files owned | Needs | Model, effort |
| --- | --- | --- | --- | --- |
| 3a | Effect teammate topology, explicit player-index ↔ node-index maps, facade and `linkIdBetween` replacement served from it; CSR kept only for the search files until 3d–3f | `packages/history/src/graph.ts`, new `topology.ts` | G2 | Opus, medium |
| 3b | Opponent-distance build step: Effect graphs for `against` and `either`, a row per player and relation in the encoding G2 chose, atomic replacement, workflow step before acceptance, acceptance check against the truth samples | new `apps/api/scripts/history-distances.ts` and test, `history-accept.ts` (row check only), `refresh-nhl-history.yml`, root `package.json` script | G2, 0i | Sonnet, high |
| 3c | Store port and reader for distance rows: lazy two-row reads, size and snapshot checks, missing table is `HistoryUnavailable` for `against`/`either` only; fakes updated | `apps/api/src/history-store.ts`, `packages/history/src/store.ts`, `shapes.ts`, `tests/fakes.ts` | 3b | Sonnet, medium |
| 3d | Shared query engine for `with`: base graph for the default filter, M1 pruned projection for other filters, M2 `Cache` for whole-graph filtered work, then arc list, layer count fold, trimmed DAG and `simplePaths` (M5); limit normalization at the boundary | `packages/history/src/paths.ts` | 3a | Opus, high |
| 3e | `against` and `either` onto the engine from the distance rows and packed pairs, with teammate precedence; duplicate search, count and enumeration deleted | `packages/history/src/relation-paths.ts` | 3c, 3d | Sonnet, high |
| 3f | `farthest` onto Effect distances and the ranked example pipeline | `packages/history/src/farthest.ts` | 3d | Haiku, medium |
| 3g | Delete `buildAdjacency`, `buildOpponentAdjacency`, `Adjacency`/`OpponentAdjacency` exports and unused helpers; adapt construction types in the three CLIs and routes if any changed | `graph.ts`, `index.ts`, `apps/api` construction sites | 3e, 3f | Sonnet, low |

Done: the wave 0 corpus and every existing test pass unchanged; no alternate production search route remains.

### Wave 4 — qualify and record (parallel)

| Card | Task | Needs | Model, effort |
| --- | --- | --- | --- |
| 4a | Read-only correctness review of the stable patch | 3g | Opus, high |
| 4b | Read-only security and boundary review | 3g | Sonnet, medium |
| 4c | Read-only unnecessary-complexity review | 3g | Sonnet, medium |
| 4d | Full verification commands, independent truth and diameter acceptance, full benchmark against the G2 budgets, packaged Vercel output check | 3g | Sonnet, medium |
| 4e | Deletion audit of removed helper names, ledger and teammate-plan updates, removal of prototype comparison code | 4a–4d | Haiku, low |

Done: one runtime topology and search implementation, preserved contracts, measured performance inside the agreed budgets, clean required checks, reviewed patch and recorded evidence. Deployment and publishing remain separate authorization steps.

Do not leave a committed card uncompilable to preserve this numbering; combine tightly coupled caller and type changes when necessary.

## Verification commands for implementation

From repository root, read every result and report it:

```sh
bun run --cwd packages/history test
bun run --cwd packages/viz test
bun run test:api
bun run test:history
node --test apps/web/tests/history-atoms.test.ts apps/web/tests/url-state.test.ts apps/web/tests/viz-chain.test.ts
bun run typecheck
bun run lint
```

Run analyst tests when its contracts/callers change: `bun run --cwd packages/analyst test`. If web UI changes, also run `bun run check:tamagui` and relevant UI/rendering tests. Existing web `test:teams`, `test:social` and `test:plan` do not include the targeted history/chain tests above.

API tests build the API bundle. Separately reproduce the packaged Vercel output check using the repository's local packaging procedure: `vercel build --prod --standalone`, followed by `node apps/web/scripts/check-vercel-output.mjs .vercel/output --require-history` (adjust the output path to the actual build). Stage a verified scratch snapshot through the existing packaging flow. Also exercise the missing-snapshot build without `--require-history`. Include a history RPC against the packaged artifact and verify the snapshot stays out of unrelated functions. A source test or API bundle build is not that packaged proof. Do not deploy to obtain it.

Actual CI includes history/API checks and conditional analyst/web checks in `workspace-checks.yml`; it does not replace the complete local command set. Documentation-only EG0 does not require running application typecheck/lint/build; validate its paths, commands and diff instead.

## Existing plans and governing rules

- [NHL teammate graph plan](nhl-teammate-graph-plan.md) remains authoritative for D2/D6/D7/D14 and C-graph/C-search/C-accept semantics. This plan replaces implementation mechanics, not those product decisions.
- [History TypeScript port plan](nhl-history-typescript-port-plan.md) is still proposed; `packages/history-build` does not exist in the audited checkout. Its P0–P10 port is independent of this migration. Its preservation of packed bytes and Python truth independence remains compatible. Do not inherit its older runtime idioms over today's Effect platform rules.
- Ratstack's **name the system of record** keeps SQLite/arrays authoritative; **prove the replacement, move callers, delete the old path** makes deletion and consumer migration explicit; **measure real limits** requires full-data evidence before the representation cutover; **uncomplect** separates topology from NHL evidence and presentation.
- Follow the current Effect declarations, core-module lint rules, typed errors/unions, and Node-services requirements for new tooling. Never import `effect/src/internal/*` or disable checks to accommodate the migration.

## Ledger and remaining decisions

| Cards | Replaces | Status | Required evidence |
| --- | --- | --- | --- |
| EG0 inventory and plan | — | Complete | This inventory, inspected code/declarations, recorded probes, review of 2026-11-20 |
| Wave 0 (0a–0i) | EG1, EG2 preparation | Pending | Committed edge-case tests, parity corpus, baseline benchmark, validated snapshot and truth with opponent distance samples |
| Wave 1 (1) | part of EG5 | Pending | Facade with tests on the current engine |
| Wave 2 (2a–2d) | part of EG5 | Pending | No consumer or test reads CSR directly |
| Gate (G1–G2) | EG2 | Pending | Baseline and candidate benchmark on identical bytes, budgets set before candidate numbers, recorded decisions |
| Wave 3 (3a–3g) | EG3, EG4, new build step | Pending | Topology, search and farthest parity; opponent distance rows built, stored and checked against truth; custom traversals and CSR builders removed |
| Wave 4 (4a–4e) | EG6 | Pending | Full checks, artifact proof, independent reviews and deletion audit |

Open decisions are bounded to gate G2: measured resource budgets; the projection cache capacity and TTL; the storage encoding of the opponent distance rows; and whether the serving file with those rows fits the packaged function, or `against`/`either` traversal stays on packed arrays as a recorded exception. None justifies changing path ranking, evidence or result schemas. If measurements require a different architecture, update this plan with the evidence and accepted decision before implementing the deviation.
