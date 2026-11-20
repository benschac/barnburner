import type { G2Spec } from "@antv/g2";
import type { PairSpanRow, PairTables, VizTheme } from "@nhl-reddit-stats/viz";

// Games by season for one pair of players (plan section FV9). Pure: no DOM, no colour literals. Every colour
// comes from `theme` or `clubColor`. Each bar is one season, stacked by club. Regular season and playoffs are
// facets, regular season first, and only the competitions present are drawn. Goalie partners (two goalies dressed
// for the same club, plan decision D2) form one muted series named in the legend. Two players with no shared games
// get a text note instead: G2 5.4.8 throws on a facet with no rows.

export type GamesBySeasonTables = Pick<PairTables, "spans" | "teams">;

/** Maps a club's abbreviation and its position in the sorted club list to a colour. */
export type ClubColor = (abbrev: string, index: number) => string;

export type Competition = "Regular season" | "Playoffs";

/** One bar segment: a season, a competition, and a club (or the goalie-partner series for that club's games). */
export type SeasonBarRow = {
  season: string;
  seasonId: number;
  competition: Competition;
  club: string;
  games: number;
  goaliePartner: boolean;
  series: string;
};

export type OrdinalColorScale = {
  type: "ordinal";
  domain: string[];
  range: string[];
};

/** What G2's facet hands the guide function: the facet's position and its rows. */
export type FacetCell = {
  columnIndex: number;
};
/** The y guide of one facet. A function, because G2 5.4.8 lets a plain `{ title }` override its own "left-most facet only". */
export type YAxis = (
  facet: FacetCell,
  data: unknown[]
) => { title: string | false; tick?: null; label?: null; grid?: null };

/** The stacked bars inside each competition facet. */
export type BarsChild = {
  type: "interval";
  encode: { x: "season"; y: "games"; color: "series" };
  transform: { type: "stackY" }[];
  scale: { x: { domain: string[] }; color: OrdinalColorScale };
  axis: { y: YAxis };
  legend: { color: { position: "top" } };
};

/** The shared-games facet: one column per competition present, each holding stacked bars. */
export type GamesFacetSpec = {
  type: "facetRect";
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  data: SeasonBarRow[];
  encode: { x: "competition" };
  scale: { x: { domain: Competition[] }; color: OrdinalColorScale };
  children: [BarsChild];
};

/** No shared games: a single text mark, with no facet (G2 5.4.8 throws on a facet with no rows). */
export type NoSharedGamesSpec = {
  type: "text";
  data: { x: number; y: number; text: string }[];
  encode: { x: "x"; y: "y"; text: "text" };
  scale: { x: { domain: number[] }; y: { domain: number[] } };
  style: { fill: string; textAlign: "center" };
  axis: false;
};

export type GamesBySeasonSpec = GamesFacetSpec | NoSharedGamesSpec;

// G2 draws each facet's axes outside the facet, in the parent view's padding, and sizes that padding only from the
// parent's own components (the legend and the facet titles), so the facet's tick labels and season labels fall
// outside the canvas unless the spec reserves room. Pixels: two-digit y ticks and the title on the left, the legend and the facet titles on top, one line of season labels
// and the x title below.
const PADDING = { left: 56, right: 8, top: 88, bottom: 40 };

// Only the left-most facet carries the y ticks and the title; the others keep their grid, and none when empty.
const yAxis: YAxis = (facet, data) => {
  const grid = data.length > 0 ? {} : { grid: null };
  return facet.columnIndex === 0
    ? { title: "Games", ...grid }
    : { title: false, tick: null, label: null, ...grid };
};

const COMPETITIONS: Competition[] = ["Regular season", "Playoffs"];
const GOALIE_PARTNERS = "Goalie partners";
const NO_SHARED_GAMES = "These two players never played together.";

const competitionName = (gameType: PairSpanRow["gameType"]): Competition =>
  gameType === 2 ? "Regular season" : "Playoffs";

/** 19501951 becomes "1950–51" (en dash). */
const seasonLabel = (seasonId: number): string =>
  `${Math.floor(seasonId / 10000)}–${String(seasonId % 100).padStart(2, "0")}`;

export function gamesBySeasonRows(tables: GamesBySeasonTables): SeasonBarRow[] {
  const abbrevById = new Map(
    tables.teams.map((team) => [team.teamId, team.abbrev] as const)
  );
  return tables.spans
    .map((span) => {
      const club = abbrevById.get(span.teamId);
      if (club === undefined) {
        // defect: a span names a club the teams table does not carry; the table builder must send both.
        throw new Error(
          `games-by-season: team ${span.teamId} is missing from the teams table`
        );
      }
      const goaliePartner = span.link === "GoaliePartners";
      return {
        season: seasonLabel(span.seasonId),
        seasonId: span.seasonId,
        competition: competitionName(span.gameType),
        club,
        games: span.games,
        goaliePartner,
        series: goaliePartner ? GOALIE_PARTNERS : club,
      };
    })
    .sort((a, b) => a.seasonId - b.seasonId || a.club.localeCompare(b.club));
}

export function gamesBySeason(
  tables: GamesBySeasonTables,
  theme: VizTheme,
  clubColor: ClubColor
): GamesBySeasonSpec {
  const rows = gamesBySeasonRows(tables);
  if (rows.length === 0) {
    return {
      type: "text",
      data: [{ x: 0.5, y: 0.5, text: NO_SHARED_GAMES }],
      encode: { x: "x", y: "y", text: "text" },
      scale: { x: { domain: [0, 1] }, y: { domain: [0, 1] } },
      style: { fill: theme.muted, textAlign: "center" },
      axis: false,
    };
  }

  const clubs = [...new Set(rows.map((row) => row.club))].sort();
  const series = rows.some((row) => row.goaliePartner)
    ? [...clubs, GOALIE_PARTNERS]
    : clubs;
  // One domain and one range, in one order, set on the facet and on its child. The facet sets the domain G2 uses
  // (otherwise it builds one from the data in first-seen order), and G2 5.4.8 applies the range only when the child
  // carries the scale too, so both get the same object.
  const color: OrdinalColorScale = {
    type: "ordinal",
    domain: series,
    range: series.map((name) =>
      name === GOALIE_PARTNERS
        ? theme.muted
        : clubColor(name, clubs.indexOf(name))
    ),
  };
  const seasons = [...new Set(rows.map((row) => row.season))];

  return {
    type: "facetRect",
    paddingLeft: PADDING.left,
    paddingRight: PADDING.right,
    paddingTop: PADDING.top,
    paddingBottom: PADDING.bottom,
    data: rows,
    encode: { x: "competition" },
    scale: {
      x: {
        domain: COMPETITIONS.filter((name) =>
          rows.some((row) => row.competition === name)
        ),
      },
      color,
    },
    children: [
      {
        type: "interval",
        encode: { x: "season", y: "games", color: "series" },
        transform: [{ type: "stackY" }],
        scale: { x: { domain: seasons }, color },
        axis: { y: yAxis },
        legend: { color: { position: "top" } },
      },
    ],
  };
}

/** Compile-time check that every result is a G2 spec: the chart host takes a G2Spec. */
export const asG2Spec = (spec: GamesBySeasonSpec): G2Spec => spec;
