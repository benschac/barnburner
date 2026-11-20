import type { G2Spec } from "@antv/g2";
import { Effect } from "effect";
import { useEffect, useRef, useState } from "react";
import type { TamaguiElement } from "tamagui";

import { createChart } from "./viz/g2-spec";
import type { G2Theme } from "./viz/g2-spec";

/**
 * Mounts a G2 chart into the element the returned `host` ref points at. Each spec, theme or height change
 * builds a fresh chart, so nothing of the previous spec survives. The hook owns the size: the measured width and
 * the height are applied after the spec. It follows the element's width, destroys the chart on unmount,
 * logs a failed render through the Effect logger and reports it as `failed`.
 */
export function useG2Chart(spec: G2Spec, theme: G2Theme, heightPx: number) {
  const host = useRef<TamaguiElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!(node instanceof HTMLElement)) return;
    let disposed = false;
    // A rejection from a chart that was disposed is expected; from a live chart it is a failure.
    const onFailure = (cause: unknown) => {
      if (disposed) return;
      void Effect.runFork(Effect.logError("G2 chart failed", cause));
      setFailed(true);
    };
    setFailed(false);
    const instance = createChart(node, spec, theme, heightPx);
    instance.render().catch(onFailure);
    const observer = new ResizeObserver(() => {
      if (disposed || node.clientWidth === 0) return;
      instance.changeSize(node.clientWidth, heightPx).catch(onFailure);
    });
    observer.observe(node);
    return () => {
      disposed = true;
      observer.disconnect();
      instance.destroy();
    };
  }, [spec, theme, heightPx]);

  return { host, failed };
}
