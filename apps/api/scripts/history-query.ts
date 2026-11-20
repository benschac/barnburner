import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import {
  DEFAULT_FILTER,
  farthest,
  finalsCoverage,
  findPaths,
  link,
  makeGraph,
  opponents,
} from "@nhl-reddit-stats/history";
import type {
  Filter,
  FinalsYear,
  HistoryStore,
  PlayerRow,
  StintRow,
  HistoryUnavailable,
} from "@nhl-reddit-stats/history";
import type { WireHop } from "@nhl-reddit-stats/history/rpc";
import { Config, Console, Effect, Option, Result, Schema } from "effect";
import { Argument, CliError, Command, Flag } from "effect/cli";

import { fillOpponentHops } from "../src/history-routes.ts";
import { openHistoryStore } from "../src/history-store.ts";

// Query the history serving file from the terminal. It runs the same package functions as the API
// handlers (findPaths, link, opponents, farthest, finalsCoverage, fillOpponentHops) on the opened store.
//
//   node scripts/history-query.ts [--db <file>] <command> ...   (--help lists commands and flags)
//
// `--db` defaults to $HISTORY_DB, else the first existing of apps/web/history-data/nhl-serve.sqlite and
// data/history/nhl-serve.sqlite.

class UsageError extends Schema.TaggedError<
  UsageError,
  { readonly brand: unique symbol }
>()("UsageError", {
  message: Schema.String,
}) {}
class NoMatch extends Schema.TaggedError<
  NoMatch,
  { readonly brand: unique symbol }
>()("NoMatch", {
  query: Schema.String,
}) {}
class AmbiguousName extends Schema.TaggedError<
  AmbiguousName,
  { readonly brand: unique symbol }
>()("AmbiguousName", {
  query: Schema.String,
  candidates: Schema.Array(Schema.String),
}) {}
class NoChain extends Schema.TaggedError<
  NoChain,
  { readonly brand: unique symbol }
>()("NoChain", {
  from: Schema.String,
  to: Schema.String,
}) {}

const rootFile = (relative: string) =>
  fileURLToPath(new URL(`../../../${relative}`, import.meta.url));

const defaultDb = Effect.gen(function* () {
  const fromEnv = yield* Config.String("HISTORY_DB").pipe(
    Config.withDefault(""),
    Effect.orDie
  );
  if (fromEnv !== "") return fromEnv;
  const candidates = [
    rootFile("apps/web/history-data/nhl-serve.sqlite"),
    rootFile("data/history/nhl-serve.sqlite"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
});

const foldName = (name: string): string =>
  name.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase();

const seasonLabel = (seasonId: number): string => {
  const start = Math.floor(seasonId / 10000);
  return `${start}–${String(start + 1).slice(-2)}`;
};

const competitionLabel = (gameType: 2 | 3): string =>
  gameType === 2 ? "regular season" : "playoffs";

const describePlayer = (p: PlayerRow): string =>
  `${p.name} (id ${p.playerId}, ${p.position}, ${seasonLabel(p.firstSeason)} to ${seasonLabel(p.lastSeason)})`;

const resolve = (
  store: HistoryStore,
  text: string
): Effect.Effect<PlayerRow, HistoryUnavailable | NoMatch | AmbiguousName> =>
  Effect.gen(function* () {
    if (/^\d+$/.test(text)) {
      const { player } = yield* store
        .player(Number(text))
        .pipe(
          Effect.catchTag("UnknownPlayer", () =>
            Effect.fail(new NoMatch({ query: text }))
          )
        );
      return player;
    }
    const found = yield* store.searchPlayers(text, 20);
    const folded = foldName(text.trim());
    const exact = found.filter((p) => foldName(p.name) === folded);
    const pool = exact.length > 0 ? exact : found;
    if (pool.length === 0) return yield* new NoMatch({ query: text });
    if (pool.length > 1)
      return yield* new AmbiguousName({
        query: text,
        candidates: pool.map(describePlayer),
      });
    return pool[0];
  });

type Detail = {
  readonly name: string;
  readonly stints: readonly StintRow[];
};

type Names = {
  readonly name: (id: number) => Effect.Effect<string, HistoryUnavailable>;
  readonly team: (
    playerId: number,
    teamId: number
  ) => Effect.Effect<string, HistoryUnavailable>;
  readonly date: (hop: WireHop) => Effect.Effect<string, HistoryUnavailable>;
};

const makeNames = (store: HistoryStore): Names => {
  const details = new Map<number, Effect.Effect<Detail, HistoryUnavailable>>();
  const detail = (id: number) => {
    let cached = details.get(id);
    if (cached === undefined) {
      cached = store.player(id).pipe(
        Effect.map(({ player, stints }): Detail => ({
          name: player.name,
          stints,
        })),
        Effect.catchTag("UnknownPlayer", () =>
          Effect.succeed<Detail>({ name: `player ${id}`, stints: [] })
        )
      );
      details.set(id, cached);
    }
    return cached;
  };
  return {
    name: (id) => Effect.map(detail(id), (d) => d.name),
    team: (playerId, teamId) =>
      Effect.map(
        detail(playerId),
        (d) =>
          d.stints.find((s) => s.teamId === teamId)?.teamAbbrev ??
          `team ${teamId}`
      ),
    date: (hop) => {
      const pick = (
        rows: readonly {
          readonly gameId: number;
          readonly gameDate: string;
        }[]
      ) => rows.find((g) => g.gameId === hop.gameId)?.gameDate ?? "?";
      const found =
        hop._tag === "PlayedAgainst"
          ? Effect.map(store.opposedGames(hop.from, hop.to), pick)
          : Effect.map(
              store.sharedGames(
                hop.from,
                hop.to,
                hop.seasonId,
                hop.gameType,
                hop.teamId,
                hop._tag
              ),
              pick
            );
      return found.pipe(
        Effect.catchTag("UnknownPlayer", () => Effect.succeed("?"))
      );
    },
  };
};

const hopLine = (names: Names, hop: WireHop) =>
  Effect.gen(function* () {
    const from = yield* names.name(hop.from);
    const to = yield* names.name(hop.to);
    const date = yield* names.date(hop);
    const plural = hop.games === 1 ? "game" : "games";
    if (hop._tag === "PlayedAgainst") {
      return `${from} → ${to}: ${hop.games} ${plural} against, first game ${hop.gameId} (${date})`;
    }
    const team = yield* names.team(hop.from, hop.teamId);
    const kind = hop._tag === "GoaliePartners" ? ", goalie partners" : "";
    return `${from} → ${to}: ${hop.games} ${plural}, ${team} ${seasonLabel(hop.seasonId)} ${competitionLabel(hop.gameType)}${kind}, game ${hop.gameId} (${date})`;
  });

const finalsLine = (names: Names, year: FinalsYear) =>
  Effect.gen(function* () {
    if (year._tag === "Miss") return `${year.year}: no teammate in the Final`;
    const who = yield* names.name(year.playerId);
    return `${year.year}: ${who} (Final game ${year.finalGameId}, shared game ${year.sharedGameId})`;
  });

const print = (lines: readonly string[]) => Console.log(lines.join("\n"));

const player = (name: string) =>
  Argument.String(name).pipe(
    Argument.withDescription("A player name (accent-folded) or numeric ID.")
  );

const count = (name: string, fallback: number, description: string) =>
  Flag.Int(name).pipe(
    Flag.filter(
      (n) => n >= 0,
      (n) => `--${name} must be zero or more, got ${n}.`
    ),
    Flag.withDefault(fallback),
    Flag.withDescription(description)
  );

const season = (name: string, description: string) =>
  Flag.Int(name).pipe(
    Flag.optional,
    Flag.withDescription(`${description} season ID, such as 19801981.`)
  );

const filterFlags = {
  regular: Flag.Boolean("regular").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Regular-season games only.")
  ),
  playoff: Flag.Boolean("playoff").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Playoff games only.")
  ),
  fromSeason: season("from-season", "First"),
  toSeason: season("to-season", "Last"),
  partners: Flag.Boolean("partners").pipe(
    Flag.withDefault(true),
    Flag.withDescription(
      "Count goalie partners as links; --no-partners leaves them out."
    )
  ),
};

type FilterFlags = {
  readonly regular: boolean;
  readonly playoff: boolean;
  readonly fromSeason: Option.Option<number>;
  readonly toSeason: Option.Option<number>;
  readonly partners: boolean;
};

const toFilter = (flags: FilterFlags): Effect.Effect<Filter, UsageError> => {
  if (flags.regular && flags.playoff)
    return Effect.fail(
      new UsageError({ message: "Use only one of --regular and --playoff." })
    );
  return Effect.succeed({
    ...DEFAULT_FILTER,
    competition: flags.regular ? "regular" : flags.playoff ? "playoff" : "all",
    fromSeason: Option.getOrNull(flags.fromSeason),
    toSeason: Option.getOrNull(flags.toSeason),
    goaliePartners: flags.partners,
  });
};

const root = Command.make("history-query").pipe(
  Command.withSharedFlags({
    db: Flag.String("db").pipe(
      Flag.optional,
      Flag.withDescription(
        "Serving file; defaults to $HISTORY_DB or the local build."
      )
    ),
  }),
  Command.withDescription("Query the NHL history serving file.")
);

// A one-shot command: the store stays open until the process exits.
const session = Effect.gen(function* () {
  const { db } = yield* root;
  const path = yield* Option.match(db, {
    onNone: () => defaultDb,
    onSome: Effect.succeed,
  });
  const store = yield* openHistoryStore(path);
  return {
    store,
    graph: makeGraph(store.graph.arrays),
    names: makeNames(store),
  };
});

const pathCommand = Command.make(
  "path",
  {
    ...filterFlags,
    relation: Flag.Literals("relation", ["with", "against", "either"]).pipe(
      Flag.withDefault("with"),
      Flag.withDescription(
        "Link through teammates (with), opponents (against), or either."
      )
    ),
    limit: count("limit", 1, "Chains to list, 1 to 10 (default 1)."),
    from: player("from"),
    to: player("to"),
  },
  (config) =>
    Effect.gen(function* () {
      const filter = yield* toFilter(config);
      const { store, graph, names } = yield* session;
      const a = yield* resolve(store, config.from);
      const b = yield* resolve(store, config.to);
      const found = findPaths(
        graph,
        a.playerId,
        b.playerId,
        filter,
        config.relation,
        Math.min(Math.max(config.limit, 1), 10)
      );
      if (Result.isFailure(found)) {
        if (found.failure._tag === "NoPath")
          return yield* new NoChain({ from: a.name, to: b.name });
        return yield* found.failure;
      }
      const filled = yield* fillOpponentHops(store, found.success);
      const chains = yield* Effect.forEach(filled.paths, (path, index) =>
        Effect.map(
          Effect.forEach(path, (hop) => hopLine(names, hop)),
          (lines) =>
            filled.paths.length > 1 ? [`Chain ${index + 1}:`, ...lines] : lines
        )
      );
      yield* print([
        `${filled.distance} hop(s); ${filled.pathCount}${filled.pathCountCapped ? "+" : ""} shortest chain(s).`,
        ...chains.flat(),
      ]);
    })
).pipe(Command.withDescription("Shortest chain(s) between two players."));

const playerCommand = Command.make(
  "player",
  { player: player("player") },
  (config) =>
    Effect.gen(function* () {
      const { store } = yield* session;
      const a = yield* resolve(store, config.player);
      const { player: row, stints } = yield* store.player(a.playerId);
      const out = [
        describePlayer(row),
        `${row.games} games, ${row.points} points, ${row.teammates} teammates.`,
      ];
      for (const s of stints) {
        out.push(
          `  ${seasonLabel(s.seasonId)} ${competitionLabel(s.gameType)}: ${s.teamAbbrev} (${s.teamName}), ${s.games} games`
        );
      }
      yield* print(out);
    })
).pipe(Command.withDescription("Player summary and stints."));

const linkCommand = Command.make(
  "link",
  {
    ...filterFlags,
    from: player("from"),
    to: player("to"),
  },
  (config) =>
    Effect.gen(function* () {
      const filter = yield* toFilter(config);
      const { store, graph, names } = yield* session;
      const a = yield* resolve(store, config.from);
      const b = yield* resolve(store, config.to);
      const result = link(graph, a.playerId, b.playerId, filter);
      if (Result.isFailure(result)) return yield* result.failure;
      const { spans, totalGames, evidenceGameId, opposedGames } =
        result.success;
      if (spans.length === 0) {
        return yield* print([
          `${a.name} and ${b.name}: not teammates with these filters; ${opposedGames} games against each other.`,
        ]);
      }
      const spanLines = yield* Effect.forEach(spans, (span) =>
        Effect.map(names.team(a.playerId, span.teamId), (team) => {
          const kind =
            span.link === "GoaliePartners" ? ", goalie partners" : "";
          return `  ${team} ${seasonLabel(span.seasonId)} ${competitionLabel(span.gameType)}: ${span.games} games${kind}, first game ${span.firstGameId}`;
        })
      );
      yield* print([
        `${a.name} and ${b.name}: ${totalGames} games together, ${opposedGames} against; evidence game ${evidenceGameId}.`,
        ...spanLines,
      ]);
    })
).pipe(Command.withDescription("How two players are linked."));

const opponentsCommand = Command.make(
  "opponents",
  {
    limit: count("limit", 20, "Opponents to list (default 20)."),
    player: player("player"),
  },
  (config) =>
    Effect.gen(function* () {
      const { store, graph, names } = yield* session;
      const a = yield* resolve(store, config.player);
      const found = opponents(graph, a.playerId);
      if (Result.isFailure(found)) return yield* found.failure;
      const rows = yield* Effect.forEach(
        found.success.slice(0, config.limit),
        (o) =>
          Effect.map(
            names.name(o.playerId),
            (name) => `  ${name}: ${o.games} games`
          )
      );
      yield* print([`${a.name}: ${found.success.length} opponents.`, ...rows]);
    })
).pipe(Command.withDescription("Most-faced opponents."));

const farthestCommand = Command.make(
  "farthest",
  {
    ...filterFlags,
    player: player("player"),
  },
  (config) =>
    Effect.gen(function* () {
      const filter = yield* toFilter(config);
      const { store, graph, names } = yield* session;
      const a = yield* resolve(store, config.player);
      const found = farthest(graph, a.playerId, filter);
      if (Result.isFailure(found)) return yield* found.failure;
      const { distance, atDistance, reachable, unreachable, example } =
        found.success;
      const hops = yield* Effect.forEach(example, (hop) => hopLine(names, hop));
      yield* print([
        `${a.name}: farthest teammate chain is ${distance} hop(s), ${atDistance} player(s) at that distance; ${reachable} reachable, ${unreachable} not.`,
        ...hops,
      ]);
    })
).pipe(
  Command.withDescription("The player's farthest reachable teammate chain.")
);

const finalsCommand = Command.make(
  "finals",
  {
    from: count("from", 1980, "First Final year (default 1980)."),
    to: count("to", 2026, "Last Final year (default 2026)."),
    player: player("player"),
  },
  (config) =>
    Effect.gen(function* () {
      const { store, graph, names } = yield* session;
      const a = yield* resolve(store, config.player);
      const years = yield* finalsCoverage(
        graph,
        store,
        a.playerId,
        config.from,
        config.to
      );
      const lines = yield* Effect.forEach(years, (year) =>
        finalsLine(names, year)
      );
      yield* print([
        `${a.name}: Cup Finals ${config.from}-${config.to}.`,
        ...lines,
      ]);
    })
).pipe(
  Command.withDescription("Stanley Cup Finals coverage through teammates.")
);

const app = root.pipe(
  Command.withSubcommands([
    pathCommand,
    playerCommand,
    linkCommand,
    opponentsCommand,
    farthestCommand,
    finalsCommand,
  ])
);

const fail = (message: string) =>
  Effect.sync(() => {
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });

const run = Command.run(app, { version: "0.0.0" }).pipe(
  Effect.catchTags({
    UsageError: (e) => fail(e.message),
    NoMatch: (e) => fail(`No player matches "${e.query}".`),
    AmbiguousName: (e) =>
      fail(
        `"${e.query}" matches several players; use an ID:\n${e.candidates.map((c) => `  ${c}`).join("\n")}`
      ),
    NoChain: (e) =>
      fail(`No chain between ${e.from} and ${e.to} with these filters.`),
    HistoryUnavailable: (e) => fail(`History unavailable: ${e.message}`),
    UnknownPlayer: (e) => fail(`Unknown player ${e.playerId}.`),
    UnsupportedFilter: (e) =>
      fail(
        `--relation ${e.relation} supports no competition, season, or partner flags.`
      ),
  }),
  // effect/cli has already printed parse errors and help; only the exit code is left.
  Effect.catchIf(CliError.isCliError, () =>
    Effect.sync(() => {
      process.exitCode = 1;
    })
  ),
  Effect.provide(NodeServices.layer)
);

await Effect.runPromise(run);
