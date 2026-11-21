import type {
  FindPathResult,
  GetPlayerResult,
  WireHop,
} from "@nhl-reddit-stats/history/rpc";
import { Array, Data } from "effect";

// Path graph (live player search): one FindPath result plus the details of every player on it becomes
// G6-shaped nodes, edges and chains. Pure; no G6 import. The server's D6 order is kept everywhere:
// chains[i] is result.paths[i], hops run in path order, and nothing is sorted.

export type PlayerDetail = typeof GetPlayerResult.Type;
type PathResult = typeof FindPathResult.Type;

export type PathNodeData = {
  readonly playerId: number;
  readonly name: string;
  readonly position: "C" | "L" | "R" | "D" | "G";
  readonly firstSeason: number;
  readonly lastSeason: number;
  readonly games: number;
  /** True for the two ends of the search. */
  readonly end: boolean;
};

export type PathNode = { readonly id: string; readonly data: PathNodeData };

type TeammateEdgeData = {
  readonly label: string;
  readonly games: number;
  readonly teamId: number;
  readonly teamAbbrev: string;
  readonly seasonId: number;
  readonly gameType: 2 | 3;
  /** The game that proves the hop. */
  readonly evidenceGameId: number;
};

export type PathEdgeData = Data.TaggedEnum<{
  PlayedWith: TeammateEdgeData;
  GoaliePartners: TeammateEdgeData;
  PlayedAgainst: {
    readonly label: string;
    readonly games: number;
    /** The first game the two met in. */
    readonly firstGameId: number;
  };
}>;
export const PathEdgeData = Data.taggedEnum<PathEdgeData>();

export type PathEdge = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly data: PathEdgeData;
  /** G6 draws the edge label from `style.labelText`. */
  readonly style: { readonly labelText: string };
};

export type PathChain = {
  readonly edgeIds: readonly string[];
  /** Player IDs in chain order, start to target. */
  readonly playerIds: readonly number[];
  readonly names: readonly string[];
};

export type PathGraph = {
  nodes: PathNode[];
  edges: PathEdge[];
  /** chains[i] is result.paths[i]. */
  readonly chains: readonly PathChain[];
};

/** 19881989 reads as "1988–89". */
const seasonLabel = (seasonId: number): string => {
  const start = Math.floor(seasonId / 10000);
  return `${start}–${String(seasonId % 10000).slice(2)}`;
};

const count = (games: number, noun: string, plural: string): string =>
  games === 1 ? `1 ${noun}` : `${games} ${plural}`;

/** Every player ID the graph needs details for, deduped, in first-appearance order; always has both ends. */
export const pathPlayerIds = (
  result: PathResult,
  from: number,
  to: number
): readonly number[] =>
  Array.dedupe([
    from,
    ...result.paths.flatMap((path) =>
      path.flatMap((hop) => [hop.from, hop.to])
    ),
    to,
  ]);

const detailOf = (
  players: ReadonlyMap<number, PlayerDetail>,
  playerId: number
): PlayerDetail => {
  const detail = players.get(playerId);
  if (detail === undefined) {
    // defect: a hop names a player the caller did not fetch (see pathPlayerIds)
    throw new Error(`path graph has no details for player ${playerId}`);
  }
  return detail;
};

const teamAbbrev = (
  hop: Extract<WireHop, { readonly teamId: number }>,
  players: ReadonlyMap<number, PlayerDetail>
): string => {
  const matches = (detail: PlayerDetail | undefined) =>
    detail?.stints.find(
      (stint) =>
        stint.teamId === hop.teamId &&
        stint.seasonId === hop.seasonId &&
        stint.gameType === hop.gameType
    );
  return (
    matches(players.get(hop.from))?.teamAbbrev ??
    matches(players.get(hop.to))?.teamAbbrev ??
    String(hop.teamId)
  );
};

const edgeData = (
  hop: WireHop,
  players: ReadonlyMap<number, PlayerDetail>
): PathEdgeData => {
  switch (hop._tag) {
    case "PlayedWith": {
      const abbrev = teamAbbrev(hop, players);
      return PathEdgeData.PlayedWith({
        label: `${abbrev} ${seasonLabel(hop.seasonId)} · ${count(hop.games, "game", "games")}`,
        games: hop.games,
        teamId: hop.teamId,
        teamAbbrev: abbrev,
        seasonId: hop.seasonId,
        gameType: hop.gameType,
        evidenceGameId: hop.gameId,
      });
    }
    case "GoaliePartners": {
      const abbrev = teamAbbrev(hop, players);
      return PathEdgeData.GoaliePartners({
        label: `${abbrev} ${seasonLabel(hop.seasonId)} · ${hop.games} dressed`,
        games: hop.games,
        teamId: hop.teamId,
        teamAbbrev: abbrev,
        seasonId: hop.seasonId,
        gameType: hop.gameType,
        evidenceGameId: hop.gameId,
      });
    }
    case "PlayedAgainst": {
      return PathEdgeData.PlayedAgainst({
        label: `${count(hop.games, "game", "games")} against`,
        games: hop.games,
        firstGameId: hop.gameId,
      });
    }
  }
};

export const pathGraph = (input: {
  readonly from: number;
  readonly to: number;
  readonly result: PathResult;
  readonly players: ReadonlyMap<number, PlayerDetail>;
}): PathGraph => {
  const { from, to, result, players } = input;
  const nodes = new Map<string, PathNode>();
  const edges = new Map<string, PathEdge>();

  const addNode = (playerId: number) => {
    const id = String(playerId);
    if (nodes.has(id)) return;
    const { player } = detailOf(players, playerId);
    nodes.set(id, {
      id,
      data: {
        playerId,
        name: player.name,
        position: player.position,
        firstSeason: player.firstSeason,
        lastSeason: player.lastSeason,
        games: player.games,
        end: playerId === from || playerId === to,
      },
    });
  };
  const addEdge = (hop: WireHop): string => {
    const id = `${hop.from}-${hop.to}`;
    if (!edges.has(id)) {
      const data = edgeData(hop, players);
      edges.set(id, {
        id,
        source: String(hop.from),
        target: String(hop.to),
        data,
        style: { labelText: data.label },
      });
    }
    return id;
  };

  const chains = result.paths.map((path): PathChain => {
    const playerIds =
      path.length === 0
        ? [from]
        : [path[0]?.from ?? from, ...path.map((hop) => hop.to)];
    playerIds.forEach(addNode);
    const edgeIds = path.map(addEdge);
    return {
      edgeIds,
      playerIds,
      names: playerIds.map((id) => detailOf(players, id).player.name),
    };
  });

  return {
    nodes: Array.fromIterable(nodes.values()),
    edges: Array.fromIterable(edges.values()),
    chains,
  };
};
