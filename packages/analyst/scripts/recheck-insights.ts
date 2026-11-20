import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { Array, Effect, Order, Result, Schema } from "effect";

import { logError } from "../../../lib/logger.mjs";
import { openDb } from "../src/db.ts";
import { guardQuery } from "../src/guard.ts";
import { recheck } from "../src/recheck.ts";
import type { RecheckContext } from "../src/recheck.ts";
import type { Db, DbError, Guard, SqlError } from "../src/shapes.ts";
import { readCards, writeCards } from "../src/store.ts";
import type { StoreError } from "../src/store.ts";

// The poster snapshot ships with the repo; one that does not decode is a defect.
const decodePoster = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      fetchedAt: Schema.String,
      completedGameIds: Schema.Array(Schema.Finite),
    })
  )
);

export type RecheckOptions = {
  readonly dir: string;
  readonly deps: { db: Db; guard: Guard };
  readonly ctx: RecheckContext;
};

export type RecheckSummary = {
  readonly unchanged: number;
  readonly refreshed: number;
  readonly stale: number;
};

const allTeams = (dir: string): string[] =>
  Array.sort(
    readdirSync(dir)
      .filter((name) => /^[A-Z]{3}\.json$/.test(name))
      .map((name) => name.slice(0, 3)),
    Order.String
  );

// Rechecks every approved card in every team file and writes back only the files that changed.
// Fails with StoreError at the first team file that cannot be read or written.
export const runRecheck = ({
  dir,
  deps,
  ctx,
}: RecheckOptions): Effect.Effect<RecheckSummary, StoreError> =>
  Effect.gen(function* () {
    const summary = { unchanged: 0, refreshed: 0, stale: 0 };
    yield* Effect.forEach(
      allTeams(dir),
      (team) =>
        Effect.gen(function* () {
          const cards = yield* Effect.fromResult(readCards(dir, team));
          const results = yield* Effect.forEach(cards, (card) =>
            recheck(deps, card, ctx)
          );
          for (const result of results) summary[result.change] += 1;
          if (results.some((result) => result.change !== "unchanged")) {
            yield* Effect.fromResult(
              writeCards(
                dir,
                team,
                results.map((result) => result.card)
              )
            );
          }
        }),
      { discard: true }
    );
    return summary;
  });

// Opens the real database, rechecks every card under dir, and returns the counts.
// A missing insights directory means zero cards.
export const recheckInsights = ({
  dir,
  dataDir,
}: {
  dir: string;
  dataDir: string;
}): Effect.Effect<RecheckSummary, StoreError | DbError | SqlError> => {
  if (!existsSync(dir))
    return Effect.succeed({ unchanged: 0, refreshed: 0, stale: 0 });
  const poster = decodePoster(
    readFileSync(join(dataDir, "nhl-poster-20262027.json"), "utf-8")
  );
  const asOf = {
    fetchedAt: poster.fetchedAt,
    completedGameIds: poster.completedGameIds.length,
  };
  return Effect.scoped(
    Effect.gen(function* () {
      const db = yield* openDb({ dataDir });
      const { rows } = yield* db.query(
        "SELECT DISTINCT game_id FROM team_games WHERE is_final"
      );
      const finals = new Set(
        rows.flatMap((row) =>
          typeof row["game_id"] === "number" ? [row["game_id"]] : []
        )
      );
      return yield* runRecheck({
        dir,
        deps: { db, guard: guardQuery },
        ctx: { finals, asOf },
      });
    })
  );
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args[i + 1];
  };
  const root = resolve(import.meta.dirname, "../../..");
  const dir = flag("--dir") ?? join(root, "data/insights/20262027");
  const dataDir = flag("--data") ?? join(root, "data");
  const result = await Effect.runPromise(
    Effect.result(recheckInsights({ dir, dataDir }))
  );
  if (Result.isFailure(result)) {
    logError(result.failure.message);
    process.exitCode = 1;
    return;
  }
  const { unchanged, refreshed, stale } = result.success;
  process.stdout.write(
    `unchanged ${unchanged}, refreshed ${refreshed}, stale ${stale}\n`
  );
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href
)
  await main();
