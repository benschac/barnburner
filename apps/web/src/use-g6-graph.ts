import { EdgeEvent } from "@antv/g6";
import type { Graph, IElementEvent } from "@antv/g6";
import { Duration, Effect, Predicate, Result } from "effect";
import { useEffect, useRef, useState } from "react";
import type { TamaguiElement } from "tamagui";

import { G6RenderError, applyHighlight } from "./viz/g6-host";

/** Longest wait for a render to settle before cleanup destroys the graph anyway (a WebGL renderer can stay pending). */
const SETTLE_MS = 1000;

/** Builds the graph in a container, or says why it cannot be drawn. */
export type BuildG6Graph = (
  container: HTMLElement
) => Result.Result<Graph, G6RenderError>;

/**
 * Mounts the graph `build` makes into the element the returned `root` ref points at. A new `build` function
 * remounts it; `heightPx` resizes it with the container. The hook renders and fits the graph, redraws the
 * highlight when `highlightedEdges` changes, reports edge hovers to `onEdgeHover` (the latest one, without a
 * rebuild), waits for a pending render before it destroys the graph on cleanup, and logs a failed draw through
 * the Effect logger and returns it as `failure`.
 */
export function useG6Graph(
  build: BuildG6Graph,
  heightPx: number,
  onEdgeHover: ((edgeId: string | null) => void) | undefined,
  highlightedEdges: readonly string[] | undefined
) {
  const root = useRef<TamaguiElement>(null);
  const [failure, setFailure] = useState<G6RenderError | null>(null);
  // The latest callback and highlight list, read by the graph without rebuilding it.
  const hoverCallback = useRef(onEdgeHover);
  const highlighted = useRef<readonly string[]>(highlightedEdges ?? []);
  const live = useRef<{ graph: Graph; drawn: Promise<unknown> } | null>(null);
  useEffect(() => {
    hoverCallback.current = onEdgeHover;
  }, [onEdgeHover]);
  useEffect(() => {
    highlighted.current = highlightedEdges ?? [];
    const current = live.current;
    if (current)
      void current.drawn.then(() => {
        if (live.current === current)
          applyHighlight(current.graph, highlighted.current);
        return undefined;
      });
  }, [highlightedEdges]);

  useEffect(() => {
    const container = root.current;
    if (!(container instanceof HTMLElement)) return;
    setFailure(null);
    const built = build(container);
    if (Result.isFailure(built)) {
      setFailure(built.failure);
      return;
    }
    const graph = built.success;
    graph.on(EdgeEvent.POINTER_ENTER, (event: IElementEvent) =>
      hoverCallback.current?.(event.target.id)
    );
    graph.on(EdgeEvent.POINTER_LEAVE, () => hoverCallback.current?.(null));
    const leave = () => hoverCallback.current?.(null);
    container.addEventListener("pointerleave", leave);
    let alive = true;
    // A rejection from a graph that was disposed is expected; from a live graph it is a failure.
    const fail = (stage: "render" | "fit") => (cause: unknown) => {
      if (!alive) return undefined;
      const error = new G6RenderError({
        stage,
        message: Predicate.isError(cause) ? cause.message : String(cause),
      });
      void Effect.runFork(Effect.logError("G6 graph failed", error));
      setFailure(error);
      return undefined;
    };
    const draw = async () => {
      try {
        await graph.render();
      } catch (cause) {
        fail("render")(cause);
        return;
      }
      if (!alive) return;
      await graph.fitView({ when: "always" }, false).catch(fail("fit"));
      // A small graph is fitted to the box, not blown up past its natural size.
      if (alive && graph.getZoom() > 1) await graph.zoomTo(1, false);
      if (alive) applyHighlight(graph, highlighted.current);
    };
    const drawn = draw();
    live.current = { graph, drawn };
    const observer = new ResizeObserver(() => {
      if (alive) graph.setSize(container.clientWidth, heightPx);
    });
    observer.observe(container);
    return () => {
      alive = false;
      live.current = null;
      observer.disconnect();
      container.removeEventListener("pointerleave", leave);
      // Destroying mid-render logs a G6 error, so wait for the render; but never wait on one that stays pending.
      const settled = Effect.tryPromise({
        try: () => drawn,
        catch: () => undefined,
      }).pipe(Effect.timeout(Duration.millis(SETTLE_MS)), Effect.ignore);
      void Effect.runPromise(
        settled.pipe(
          Effect.andThen(
            Effect.sync(() => {
              graph.destroy();
            })
          )
        )
      );
    };
  }, [build, heightPx]);

  return { root, failure };
}
