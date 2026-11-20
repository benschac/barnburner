import { Renderer as WebGLRenderer } from "@antv/g-webgl";
import { Graph } from "@antv/g6";
import { BenchMountError, benchMountError } from "@nhl-reddit-stats/viz";
import type { BenchRenderer } from "@nhl-reddit-stats/viz";
import { Array, Effect, Order } from "effect";

const MIN_SIZE = 4;
const MAX_SIZE = 24;
const MIN_OPACITY = 0.08;
const MAX_OPACITY = 0.9;

// `Array.max`, never `Math.max(...values)`: the league export has 478,383 links, past V8's argument limit. The prepended 1 is the floor that avoids dividing by zero on empty data.
const maxOf = (values: ReadonlyArray<number>): number =>
  Array.max(Array.prepend(values, 1), Order.Number);

const hasWebGl = (): boolean => {
  const probe = document.createElement("canvas");
  return (
    probe.getContext("webgl2") !== null || probe.getContext("webgl") !== null
  );
};

/** G6 5 with the WebGL renderer. CPU d3-force layout: the GPU layouts need `@antv/layout-gpu`, which is not installed. */
const renderer: BenchRenderer = {
  name: "g6-webgl",
  mount: (root, data, theme) =>
    Effect.gen(function* () {
      if (!hasWebGl())
        return yield* new BenchMountError({
          message: "g6-webgl: this browser cannot create a WebGL context",
        });
      const maxNodeGames = maxOf(data.nodes.map((n) => n.games));
      const maxLinkGames = maxOf(data.links.map((l) => l.games));
      const graph = yield* Effect.try({
        try: () =>
          new Graph({
            container: root,
            width: root.clientWidth,
            height: root.clientHeight,
            renderer: () => new WebGLRenderer(),
            // One WebGL context, not four: only the main layer draws.
            canvas: { enableMultiLayer: false },
            animation: false,
            background: theme.background,
            data: {
              nodes: data.nodes.map((n) => ({
                id: String(n.playerId),
                data: { games: n.games },
              })),
              edges: data.links.map((l) => ({
                source: String(l.a),
                target: String(l.b),
                data: { games: l.games },
              })),
            },
            node: {
              style: {
                size: (d) =>
                  MIN_SIZE +
                  (MAX_SIZE - MIN_SIZE) *
                    (Number(d.data?.games ?? 0) / maxNodeGames),
                fill: theme.brand,
                stroke: theme.background,
                lineWidth: 1,
              },
            },
            edge: {
              style: {
                stroke: theme.muted,
                lineWidth: 1,
                strokeOpacity: (d) =>
                  MIN_OPACITY +
                  (MAX_OPACITY - MIN_OPACITY) *
                    (Number(d.data?.games ?? 0) / maxLinkGames),
              },
            },
            layout: { type: "d3-force", animation: false },
          }),
        catch: benchMountError,
      });
      // mount succeeds when the layout has settled: render() awaits the post layout, the non-animated
      // d3-force simulation, before it resolves.
      yield* Effect.tryPromise({
        try: () => graph.render(),
        catch: benchMountError,
      }).pipe(
        Effect.tapError(() =>
          Effect.sync(() => {
            graph.destroy();
          })
        )
      );
      return {
        pan: (dx, dy) => {
          void graph.translateBy([dx, dy], false);
        },
        zoom: (factor) => {
          void graph.zoomBy(factor, false);
        },
        destroy: () => {
          graph.destroy();
        },
      };
    }),
};

export default renderer;
