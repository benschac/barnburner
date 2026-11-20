import type { BenchRenderer } from "@nhl-reddit-stats/viz";

export type RendererLoader = {
  readonly id: string;
  readonly load: () => Promise<{ readonly default: BenchRenderer }>;
};

// One entry per file in src/viz/bench/renderers. Each import() becomes its own chunk, fetched when Run is pressed.
// tests/viz-bench-renderers.test.ts fails when a renderer file is missing from this list.
export const rendererLoaders: readonly RendererLoader[] = [
  { id: "cosmos", load: () => import("./renderers/cosmos.ts") },
  { id: "g6-canvas", load: () => import("./renderers/g6-canvas.ts") },
  { id: "g6-webgl", load: () => import("./renderers/g6-webgl.ts") },
];
