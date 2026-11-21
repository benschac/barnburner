import type {
  GetLinkResult,
  GetPlayerResult,
  GetRosterResult,
} from "@nhl-reddit-stats/history/rpc";
import { Array, Match, Order } from "effect";

export type PlayerDetail = typeof GetPlayerResult.Type;
export type RosterDetail = typeof GetRosterResult.Type;
export type LinkDetail = typeof GetLinkResult.Type;
export type Teammate = {
  readonly playerId: number;
  readonly name: string;
  readonly position: RosterDetail["players"][number]["position"];
  readonly games: number;
  readonly goaliePartnerGames: number;
  readonly firstSeason: number;
  readonly lastSeason: number;
  readonly teams: readonly string[];
};

/** Rosters discover identities. Their link counts are career totals repeated in every roster. */
export const teammateCandidates = (
  focusPlayerId: number,
  rosters: readonly RosterDetail[]
): RosterDetail["players"] =>
  Array.dedupeWith(
    rosters.flatMap((roster) =>
      roster.players.filter((row) => {
        if (row.playerId === focusPlayerId || row.link === undefined)
          return false;
        return Match.valueTags(row.link, {
          PlayedWith: () => true,
          GoaliePartners: () => true,
          NoLink: () => false,
        });
      })
    ),
    (a, b) => a.playerId === b.playerId
  );

/** Each pair's GetLink spans are counted once, with dressed-goalie games kept apart. */
export const teammateRows = (
  detail: PlayerDetail,
  rosters: readonly RosterDetail[],
  links: ReadonlyMap<number, LinkDetail>
): Teammate[] => {
  const rows = teammateCandidates(detail.player.playerId, rosters).map(
    (row): Teammate => {
      const result = links.get(row.playerId);
      if (result === undefined || result.spans.length === 0) {
        // defect: candidates require a successful nonempty GetLink response before projection
        throw new Error(`Missing teammate spans for ${row.playerId}`);
      }
      const spans = Array.sortWith(
        result.spans,
        (span) => span.seasonId,
        Order.Number
      );
      const first = spans[0];
      const last = spans.at(-1);
      if (first === undefined || last === undefined) {
        // defect: the nonempty spans checked above must have both endpoints
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
    }
  );
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
