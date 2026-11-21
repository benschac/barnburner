# Graph lab historical previews

These files are generated NHL results, loaded with the graph pages. They are small checked-in projections so a fresh checkout can open the demos without a database, API key, network query, or file upload. They are not live queries.

- Source: the NHL archives in `data/history`, downloaded 17 November 2026.
- Source coverage: 218 regular-season/playoff partitions, 1917–18 through 2026–27; 2,585,028 credited player appearances.
- Serving snapshot: `e10c93faedc3`; latest recorded game: 16 November 2026.
- Exported 20 November 2026 using the existing visualization table builders.
- `chain-8478402-8471675.json`: Connor McDavid to Sidney Crosby, up to ten shortest teammate chains under the default history filter.
- `pair-8478402-8477934.json`: Connor McDavid and Leon Draisaitl's shared games.
- `finals-8478402-1980-2026.json`: Finals reached by McDavid's teammates, including before or after they played with him; this is not McDavid's own Finals appearance history. It contains 46 Finals; there was no 2005 Final.

The archived NHL source facts are authoritative. The base database, serving database, and these JSON tables are rebuildable projections. Do not edit the generated table rows by hand.

## Rebuild from downloaded history

Run from the repository root. The first two commands use the existing local archives and do not fetch current NHL data.

```sh
bun run data:build:history
bun run data:build:serving
node apps/api/scripts/history-viz-tables.ts --db data/history/nhl-serve.sqlite --out apps/web/src/viz/lab/data chain 8478402 8471675
node apps/api/scripts/history-viz-tables.ts --db data/history/nhl-serve.sqlite --out apps/web/src/viz/lab/data pair 8478402 8477934
node apps/api/scripts/history-viz-tables.ts --db data/history/nhl-serve.sqlite --out apps/web/src/viz/lab/data finals 8478402 --from 1980 --to 2026
node --test apps/web/tests/viz-previews.test.ts
```

When regenerating from a newer archive, update the snapshot/date above and the date displayed by `VizLabIsland.tsx`. Keep the exported player IDs and year range aligned with the page descriptions and the preview tests.

For another pair or player, use the same export CLI with different IDs or player names, then select that file in the corresponding demo. A future player-search UI should call these same table builders on the server, returning only the requested tables. Do not ship the SQLite database or rebuild it in a browser.
