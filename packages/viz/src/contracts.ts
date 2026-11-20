import { Effect, Predicate, Schema } from "effect";

// The shapes every frontend lane works from (plan section C-viz). No DOM code: the DOM-facing types
// below only name `HTMLElement`, which TypeScript supplies. Player IDs, never indexes, appear in rows.

// -- Rows and tables ------------------------------------------------------------------------------

/** A cell is a string, a number, or null. Booleans are the numbers 0 and 1. */
const Cell = Schema.Union([Schema.String, Schema.Finite, Schema.Null]);
export const Row = Schema.Record(Schema.String, Cell);
export type Row = typeof Row.Type;

export const Tables = Schema.Record(Schema.String, Schema.Array(Row));
export type Tables = typeof Tables.Type;

/** What a view receives. `notes` says what each table is, one sentence each, and also goes to the model. */
export const ViewData = Schema.Struct({ tables: Tables, notes: Schema.String });
export type ViewData = typeof ViewData.Type;

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Flag = Schema.Literals([0, 1]);
const PositionSchema = Schema.Literals(["C", "L", "R", "D", "G"]);
/** A pair is stored once, lower player ID first. */
const aBelowB = Schema.makeFilter<{ readonly a: number; readonly b: number }>(
  (row) => row.a < row.b,
  { expected: "a pair with a < b" }
);

const LinkKindSchema = Schema.Literals(["PlayedWith", "GoaliePartners"]);

const PlayerFields = {
  playerId: Schema.Int,
  name: Schema.String,
  position: PositionSchema,
  firstSeason: Schema.Int,
  lastSeason: Schema.Int,
  games: Count,
};

/** A `players` row. */
export const PlayerRow = Schema.Struct(PlayerFields);
export type PlayerRow = typeof PlayerRow.Type;

/** A `teams` row. */
export const TeamRow = Schema.Struct({
  teamId: Schema.Int,
  abbrev: Schema.String,
  name: Schema.String,
});
export type TeamRow = typeof TeamRow.Type;

// -- chain: `from, to`, default filter, limit 10 ----------------------------------------------------

/** One hop of one chain. `chain` and `step` count from 0, and rows are in D6 order. */
export const ChainHopRow = Schema.Struct({
  chain: Count,
  step: Count,
  from: Schema.Int,
  to: Schema.Int,
  kind: LinkKindSchema,
  games: Count,
  teamId: Schema.Int,
  seasonId: Schema.Int,
  gameType: Schema.Literals([2, 3]),
  gameId: Schema.Int,
});
export type ChainHopRow = typeof ChainHopRow.Type;

export const ChainSummaryRow = Schema.Struct({
  from: Schema.Int,
  to: Schema.Int,
  distance: Count,
  pathCount: Count,
  pathCountCapped: Flag,
});
export type ChainSummaryRow = typeof ChainSummaryRow.Type;

export const ChainTables = Schema.Struct({
  players: Schema.Array(PlayerRow),
  teams: Schema.Array(TeamRow),
  hops: Schema.Array(ChainHopRow),
  summary: Schema.Array(ChainSummaryRow),
});
export type ChainTables = typeof ChainTables.Type;

// -- pair: `a, b` ------------------------------------------------------------------------------------

export const PairSpanRow = Schema.Struct({
  seasonId: Schema.Int,
  gameType: Schema.Literals([2, 3]),
  teamId: Schema.Int,
  link: LinkKindSchema,
  games: Count,
  firstGameId: Schema.Int,
});
export type PairSpanRow = typeof PairSpanRow.Type;

export const PairSummaryRow = Schema.Struct({
  a: Schema.Int,
  b: Schema.Int,
  totalGames: Count,
  opposedGames: Count,
}).check(aBelowB);
export type PairSummaryRow = typeof PairSummaryRow.Type;

export const PairTables = Schema.Struct({
  players: Schema.Array(PlayerRow),
  teams: Schema.Array(TeamRow),
  spans: Schema.Array(PairSpanRow),
  summary: Schema.Array(PairSummaryRow),
});
export type PairTables = typeof PairTables.Type;

// -- ego: `playerId` ---------------------------------------------------------------------------------

export const EgoFocusRow = Schema.Struct({ playerId: Schema.Int });
export type EgoFocusRow = typeof EgoFocusRow.Type;

/** The focus player and every teammate. `gamesWithFocus` is 0 on the focus player's own row. */
export const EgoPlayerRow = Schema.Struct({
  ...PlayerFields,
  gamesWithFocus: Count,
});
export type EgoPlayerRow = typeof EgoPlayerRow.Type;

/** A teammate link among the ego's players, with `a < b`. */
export const EgoLinkRow = Schema.Struct({
  a: Schema.Int,
  b: Schema.Int,
  games: Count,
  firstSeason: Schema.Int,
  lastSeason: Schema.Int,
}).check(aBelowB);
export type EgoLinkRow = typeof EgoLinkRow.Type;

export const EgoTables = Schema.Struct({
  focus: Schema.Array(EgoFocusRow),
  players: Schema.Array(EgoPlayerRow),
  links: Schema.Array(EgoLinkRow),
});
export type EgoTables = typeof EgoTables.Type;

// -- league: none --------------------------------------------------------------------------------

export const LeaguePlayerRow = Schema.Struct({
  ...PlayerFields,
  teammates: Count,
});
export type LeaguePlayerRow = typeof LeaguePlayerRow.Type;

/** A teammate link, with `a < b`. */
export const LeagueLinkRow = Schema.Struct({
  a: Schema.Int,
  b: Schema.Int,
  games: Count,
  firstSeason: Schema.Int,
}).check(aBelowB);
export type LeagueLinkRow = typeof LeagueLinkRow.Type;

export const LeagueTables = Schema.Struct({
  players: Schema.Array(LeaguePlayerRow),
  links: Schema.Array(LeagueLinkRow),
});
export type LeagueTables = typeof LeagueTables.Type;

// -- opponents: `a, b` -------------------------------------------------------------------------------

/** One opponent of `focus`. Rows are grouped by focus in input order, most games first, then lower ID. */
export const FacedRow = Schema.Struct({
  focus: Schema.Int,
  opponent: Schema.Int,
  games: Count,
});
export type FacedRow = typeof FacedRow.Type;

export const OpponentsTables = Schema.Struct({
  players: Schema.Array(PlayerRow),
  faced: Schema.Array(FacedRow),
});
export type OpponentsTables = typeof OpponentsTables.Type;

// -- finals: `playerId, fromYear, toYear` ------------------------------------------------------------

/** One Final year. On a miss `covered` is 0 and the last three IDs are null. */
export const FinalsRow = Schema.Struct({
  year: Schema.Int,
  seasonId: Schema.Int,
  covered: Flag,
  playerId: Schema.NullOr(Schema.Int),
  finalGameId: Schema.NullOr(Schema.Int),
  sharedGameId: Schema.NullOr(Schema.Int),
}).check(
  Schema.makeFilter<{
    readonly covered: 0 | 1;
    readonly playerId: number | null;
    readonly finalGameId: number | null;
    readonly sharedGameId: number | null;
  }>(
    (row) =>
      [row.playerId, row.finalGameId, row.sharedGameId].every(
        (id) => (id !== null) === (row.covered === 1)
      ),
    {
      expected:
        "all three IDs set when covered is 1, and all null when it is 0",
    }
  )
);
export type FinalsRow = typeof FinalsRow.Type;

export const FinalsTables = Schema.Struct({
  finals: Schema.Array(FinalsRow),
  players: Schema.Array(PlayerRow),
});
export type FinalsTables = typeof FinalsTables.Type;

// -- Theme ---------------------------------------------------------------------------------------

/**
 * Each colour is the theme value of the same name in `apps/web/design/contract.json` (`chart-win` is
 * `chartWin`). `series` is `[chartPositive, chartNegative, gold, brand, chartWin, chartLoss, muted]`.
 */
export const VizTheme = Schema.Struct({
  mode: Schema.Literals(["light", "dark"]),
  background: Schema.String,
  color: Schema.String,
  muted: Schema.String,
  gold: Schema.String,
  win: Schema.String,
  loss: Schema.String,
  pending: Schema.String,
  rule: Schema.String,
  surface: Schema.String,
  highlight: Schema.String,
  brand: Schema.String,
  bright: Schema.String,
  chartWin: Schema.String,
  chartLoss: Schema.String,
  chartPositive: Schema.String,
  chartNegative: Schema.String,
  chartLine: Schema.String,
  series: Schema.Array(Schema.String),
  fonts: Schema.Struct({ body: Schema.String, score: Schema.String }),
}).check(
  Schema.makeFilter<{
    readonly series: ReadonlyArray<string>;
    readonly chartPositive: string;
    readonly chartNegative: string;
    readonly gold: string;
    readonly brand: string;
    readonly chartWin: string;
    readonly chartLoss: string;
    readonly muted: string;
  }>(
    (theme) => {
      const expected = [
        theme.chartPositive,
        theme.chartNegative,
        theme.gold,
        theme.brand,
        theme.chartWin,
        theme.chartLoss,
        theme.muted,
      ];
      return (
        theme.series.length === expected.length &&
        expected.every((colour, i) => theme.series[i] === colour)
      );
    },
    {
      expected:
        "series equal to [chartPositive, chartNegative, gold, brand, chartWin, chartLoss, muted]",
    }
  )
);
export type VizTheme = typeof VizTheme.Type;

// -- Frame messages ------------------------------------------------------------------------------

const Milliseconds = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

/** Host to frame: run this view module. */
export const Render = Schema.TaggedStruct("Render", {
  id: Schema.String,
  code: Schema.String,
  tables: Tables,
  theme: VizTheme,
});
/** Host to frame: call the view's cleanup and clear the root. */
export const Dispose = Schema.TaggedStruct("Dispose", { id: Schema.String });
/** Frame to host: the frame loaded, with the library versions it carries. */
export const Ready = Schema.TaggedStruct("Ready", {
  versions: Schema.Record(Schema.String, Schema.String),
});
/** Frame to host: first paint finished. */
export const Rendered = Schema.TaggedStruct("Rendered", {
  id: Schema.String,
  ms: Milliseconds,
});
/** Frame to host: the module threw, or did not paint in time. */
export const Failed = Schema.TaggedStruct("Failed", {
  id: Schema.String,
  message: Schema.String,
});
/** Frame to host: sampled once a second while the view runs. */
export const FrameRate = Schema.TaggedStruct("FrameRate", {
  id: Schema.String,
  fps: Milliseconds,
});

export const HostMessage = Schema.Union([Render, Dispose]);
export type HostMessage = typeof HostMessage.Type;
export const FrameReport = Schema.Union([Ready, Rendered, Failed, FrameRate]);
export type FrameReport = typeof FrameReport.Type;
/** Every frame message, either direction, as one tagged union. */
export const FrameMessage = Schema.Union([
  Render,
  Dispose,
  Ready,
  Rendered,
  Failed,
  FrameRate,
]);
export type FrameMessage = typeof FrameMessage.Type;

// -- View module, lab entry, bench renderer ------------------------------------------------------

/**
 * What the frame hands a view module. The libraries are typed `unknown` here because this package
 * depends on none of them; the frame provides them and the module imports nothing.
 */
export type ViewContext = {
  /** Draw only inside this element. */
  readonly root: HTMLElement;
  readonly tables: Tables;
  readonly theme: VizTheme;
  readonly size: { readonly width: number; readonly height: number };
  readonly libs: {
    readonly G2: unknown;
    readonly G6: unknown;
    readonly d3: unknown;
    readonly THREE: unknown;
  };
};

/** The default export of a view module. It returns its own cleanup. */
export type RenderView = (ctx: ViewContext) => () => void;

/** What the model writes: the body of one ES module with a default export. */
export type ViewModule = { readonly default: RenderView };

/**
 * One lab page, the default export of a file in `apps/web/src/viz/lab/entries`. `Node` is the
 * host's renderable type (React's `ReactNode` in the web app), kept a parameter so this package
 * needs no React.
 */
export type LabEntry<Node = unknown> = {
  readonly title: string;
  readonly render: () => Node;
};

/** A node in a bench dataset. Size comes from `games`. */
export type BenchNode = {
  readonly playerId: number;
  readonly name: string;
  readonly games: number;
};
/** A link in a bench dataset. Opacity comes from `games`. `a` and `b` are player IDs. */
export type BenchLink = {
  readonly a: number;
  readonly b: number;
  readonly games: number;
};
export type BenchData = {
  readonly nodes: ReadonlyArray<BenchNode>;
  readonly links: ReadonlyArray<BenchLink>;
};

/** What a mounted renderer lets the harness drive. */
export type BenchHandle = {
  pan(dx: number, dy: number): void;
  zoom(factor: number): void;
  destroy(): void;
};

/** A renderer could not mount. `message` is shown on the bench page; `cause` is the foreign failure, when there is one. */
export class BenchMountError extends Schema.TaggedError<
  BenchMountError,
  { readonly brand: unique symbol }
>()("BenchMountError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

/** Turns a failure thrown or rejected by a renderer's library into a `BenchMountError` that keeps it as the cause. */
export const benchMountError = (cause: unknown): BenchMountError =>
  new BenchMountError({
    message: Predicate.isError(cause) ? cause.message : String(cause),
    cause,
  });

/**
 * The default export of a file in `apps/web/src/viz/bench/renderers`. `mount` succeeds only once the
 * renderer's layout has settled, so the time it takes is the settle time.
 */
export type BenchRenderer = {
  readonly name: string;
  mount(
    root: HTMLElement,
    data: BenchData,
    theme: VizTheme
  ): Effect.Effect<BenchHandle, BenchMountError>;
};
