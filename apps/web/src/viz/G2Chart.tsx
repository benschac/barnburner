import type { G2Spec } from "@antv/g2";
import { useMemo } from "react";
import { View, getTokens, getVariableValue, styled } from "tamagui";

import { Copy } from "../components/team-poster/primitives";
import { useG2Chart } from "../use-g2-chart";
import { g2Theme, useVizTheme } from "./theme";

/** The chart heights, as size tokens of the design contract. */
export type G2ChartHeight = "hero" | "seasonChart" | "playoffChart" | "drawer";

export type G2ChartProps = {
  spec: G2Spec;
  height: G2ChartHeight;
};

// Heights are size tokens, so the design lint can check them.
const Frame = styled(View, {
  w: "100%",
  variants: {
    size: {
      hero: { h: "hero" },
      seasonChart: { h: "seasonChart" },
      playoffChart: { h: "playoffChart" },
      drawer: { h: "drawer" },
    },
  } as const,
});

const pixels = (height: G2ChartHeight): number =>
  Number(getVariableValue(getTokens().size[height]));

/**
 * Hosts one G2 chart. Each spec or theme change builds a fresh chart, so nothing of the previous spec
 * survives. The host owns the size: the measured width and the height token are applied after the spec.
 * It follows the container's width, destroys the chart on unmount, and shows a message if a render fails.
 */
export function G2Chart({ spec, height }: G2ChartProps) {
  const theme = useVizTheme();
  // useVizTheme keeps one object until a value changes, so the chart redraws only then.
  const g2 = useMemo(() => g2Theme(theme), [theme]);
  const heightPx = pixels(height);
  const { host, failed } = useG2Chart(spec, g2, heightPx);

  return (
    <Frame ref={host} size={height}>
      {failed ? (
        <Copy color="muted">This chart could not be drawn.</Copy>
      ) : null}
    </Frame>
  );
}
