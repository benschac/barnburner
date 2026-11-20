export const historyPackage = "history" as const;

export * from "./shapes.ts";
export type { HistoryStore } from "./store.ts";
export {
  HistoryUnavailable,
  NoPath,
  UnknownPlayer,
  UnknownRoster,
  UnsupportedFilter,
} from "./contracts.ts";
export type { Adjacency, OpponentAdjacency, TeammateGraph } from "./graph.ts";
export { findPaths } from "./paths.ts";
export { farthest } from "./farthest.ts";
export { link, linkKind, makeGraph, opponents } from "./graph.ts";
export { findRelationPaths } from "./relation-paths.ts";
export { finalsCoverage } from "./finals.ts";
