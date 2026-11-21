import type {
  GetPlayerResult,
  GetTeammatesResult,
} from "@nhl-reddit-stats/history/rpc";
import { Array, Order } from "effect";

export type PlayerDetail = typeof GetPlayerResult.Type;
export type TeammatesDetail = typeof GetTeammatesResult.Type;
export type Teammate = {
  readonly playerId: number;
  readonly name: string;
  readonly position: PlayerDetail["player"]["position"];
  readonly games: number;
  readonly goaliePartnerGames: number;
  readonly firstSeason: number;
  readonly lastSeason: number;
  readonly teams: readonly string[];
};

/** Each teammate's spans are counted once, with dressed-goalie games kept apart. */
export const teammateRows = (
  detail: PlayerDetail,
  found: TeammatesDetail
): Teammate[] => {
  const rows = found.teammates.map((row): Teammate => {
    const spans = Array.sortWith(
      row.spans,
      (span) => span.seasonId,
      Order.Number
    );
    const first = spans[0];
    const last = spans.at(-1);
    if (first === undefined || last === undefined) {
      // defect: GetTeammates lists only teammates with at least one passing span
      throw new Error("Missing teammate season endpoints");
    }
    return {
      playerId: row.playerId,
      name: row.name,
      position: row.position,
      games: Array.reduce(
        spans,
        0,
        (sum, span) => sum + (span.link === "PlayedWith" ? span.games : 0)
      ),
      goaliePartnerGames: Array.reduce(
        spans,
        0,
        (sum, span) => sum + (span.link === "GoaliePartners" ? span.games : 0)
      ),
      firstSeason: first.seasonId,
      lastSeason: last.seasonId,
      teams: Array.dedupe(
        spans.map((span) => {
          const stint = detail.stints.find(
            (candidate) =>
              candidate.teamId === span.teamId &&
              candidate.seasonId === span.seasonId &&
              candidate.gameType === span.gameType
          );
          if (stint === undefined) {
            // defect: a shared span must belong to one of the focus player's stints
            throw new Error(`Missing focus stint for team ${span.teamId}`);
          }
          return stint.teamAbbrev;
        })
      ),
    };
  });
  return Array.sortBy<Teammate[]>(
    Order.mapInput(Order.flip(Order.Number), (row: Teammate) => row.games),
    Order.mapInput(Order.Number, (row: Teammate) => row.playerId)
  )(rows);
};

export const teammateGamesLabel = (row: Teammate): string =>
  `${row.games} games${row.goaliePartnerGames > 0 ? ` · ${row.goaliePartnerGames} dressed as goalie partners` : ""}`;

export const teammatesGraph = (
  detail: PlayerDetail,
  rows: readonly Teammate[],
  limit: number | "all"
) => {
  const shown = limit === "all" ? rows : rows.slice(0, limit);
  const focusId = String(detail.player.playerId);
  return {
    nodes: [
      { id: focusId, data: { name: detail.player.name } },
      ...shown.map((row) => ({
        id: String(row.playerId),
        data: { name: row.name },
      })),
    ],
    edges: shown.map((row) => ({
      id: `${focusId}-${row.playerId}`,
      source: focusId,
      target: String(row.playerId),
      style: { labelText: teammateGamesLabel(row) },
    })),
  };
};
