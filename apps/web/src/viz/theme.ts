import type { VizTheme } from "@nhl-reddit-stats/viz";
import { getConfig, getVariableValue, useTheme, useThemeName } from "tamagui";

import contract from "../../design/contract.json" with { type: "json" };
import { colourFields } from "./theme-css.ts";
import type { ColourField } from "./theme-css.ts";

// One source for the charts: every colour is a value of design/contract.json, read through the
// Tamagui theme (useVizTheme) or passed in (vizTheme). No colour literal lives in this folder.

type ThemeValues = Readonly<Record<string, string>>;

const kebab = (field: string) =>
  field.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Font families are not contract values; they arrive with the theme values under these keys. */
export const fontKeys = { body: "font-body", score: "font-score" } as const;

function read(values: ThemeValues, key: string): string {
  if (!Object.hasOwn(values, key)) {
    // defect: a caller left out a contract key
    throw new Error(`defect: theme value ${key} is missing`);
  }
  return values[key];
}

/** Builds a VizTheme from a record of theme values keyed as in contract.json, plus the two font keys. */
export function vizTheme(
  values: ThemeValues,
  mode: VizTheme["mode"]
): VizTheme {
  const c = Object.fromEntries(
    colourFields.map((field) => [field, read(values, kebab(field))])
  ) as Record<ColourField, string>;
  return {
    mode,
    background: c.background,
    color: c.color,
    muted: c.muted,
    gold: c.gold,
    win: c.win,
    loss: c.loss,
    pending: c.pending,
    rule: c.rule,
    surface: c.surface,
    highlight: c.highlight,
    brand: c.brand,
    bright: c.bright,
    chartWin: c.chartWin,
    chartLoss: c.chartLoss,
    chartPositive: c.chartPositive,
    chartNegative: c.chartNegative,
    chartLine: c.chartLine,
    series: [
      c.chartPositive,
      c.chartNegative,
      c.gold,
      c.brand,
      c.chartWin,
      c.chartLoss,
      c.muted,
    ],
    fonts: {
      body: read(values, fontKeys.body),
      score: read(values, fontKeys.score),
    },
  };
}

export { cssVariables } from "./theme-css.ts";

/** Every axis variant G2 5.4.8 defines (theme/create.js): labels and titles take the text colour at full opacity. */
function axisTheme(theme: VizTheme) {
  return {
    labelFill: theme.color,
    labelOpacity: 1,
    titleFill: theme.color,
    titleOpacity: 1,
    tickStroke: theme.rule,
    tickOpacity: 1,
    lineStroke: theme.rule,
    lineStrokeOpacity: 1,
    gridStroke: theme.rule,
    gridStrokeOpacity: 1,
  };
}

/**
 * Options for G2 (`theme` in a spec), keys as in G2 5.4.8's theme/create.js and dark.js. A mark with
 * no colour encoding takes `color`, the first series colour. Every text fill is `theme.color` at full
 * opacity, because G2's default opacities would hide it on a dark background. Only the secondary
 * subtitle uses `theme.muted`. Lines, ticks and grid lines use `theme.rule`.
 */
export function g2Theme(theme: VizTheme) {
  return {
    type: theme.mode,
    color: theme.series[0],
    // G2 switches to category20 past seven series; repeat the seven so both come only from series.
    category10: [...theme.series],
    category20: Array.from(
      { length: 20 },
      (_, index) => theme.series[index % theme.series.length]
    ),
    view: { viewFill: theme.background },
    label: {
      fill: theme.color,
      fillOpacity: 1,
      connectorStroke: theme.rule,
      connectorStrokeOpacity: 1,
    },
    text: {
      text: { fill: theme.color, fillOpacity: 1 },
      badge: { fill: theme.color, fillOpacity: 1 },
    },
    innerLabel: { fill: theme.color, fillOpacity: 1 },
    htmlLabel: { color: theme.color, opacity: 1 },
    axis: axisTheme(theme),
    axisTop: axisTheme(theme),
    axisBottom: axisTheme(theme),
    axisLeft: axisTheme(theme),
    axisRight: axisTheme(theme),
    axisLinear: axisTheme(theme),
    axisArc: axisTheme(theme),
    axisRadar: axisTheme(theme),
    lineX: { line: { stroke: theme.rule, strokeOpacity: 1 } },
    lineY: { line: { stroke: theme.rule, strokeOpacity: 1 } },
    legendCategory: {
      itemLabelFill: theme.color,
      itemLabelFillOpacity: 1,
      itemValueFill: theme.color,
      itemValueFillOpacity: 1,
      titleFill: theme.color,
      titleFillOpacity: 1,
      navButtonFill: theme.color,
      navButtonFillOpacity: 1,
      navPageNumFill: theme.color,
      navPageNumFillOpacity: 1,
      tickStroke: theme.rule,
      tickStrokeOpacity: 1,
    },
    legendContinuous: {
      labelFill: theme.color,
      labelFillOpacity: 1,
      handleLabelFill: theme.color,
      handleLabelFillOpacity: 1,
      titleFill: theme.color,
      titleFillOpacity: 1,
      tickStroke: theme.rule,
      tickStrokeOpacity: 1,
    },
    title: {
      titleFill: theme.color,
      titleFillOpacity: 1,
      subtitleFill: theme.muted,
      subtitleFillOpacity: 1,
    },
  };
}

/**
 * Theme for G6 5.1.1, keys as in node_modules/@antv/g6/lib/themes/base.js: `background`,
 * `node.style.{fill,stroke,labelFill,labelFillOpacity}`, and `edge.style.{stroke,labelFill,labelOpacity}`.
 */
export function g6Theme(theme: VizTheme) {
  return {
    background: theme.background,
    node: {
      style: {
        fill: theme.surface,
        stroke: theme.rule,
        labelFill: theme.color,
        labelFillOpacity: 1,
      },
    },
    edge: {
      style: { stroke: theme.muted, labelFill: theme.color, labelOpacity: 1 },
    },
  };
}

type TeamPalette = Readonly<
  Record<string, { readonly "team-primary": string }>
>;
const palettes: TeamPalette = contract.teamPalettes;

/**
 * A club's `team-primary` from contract.json. A club with no palette takes the series colour at
 * `index` (wrapping), so unknown clubs still get a distinct colour.
 */
export function teamColor(
  abbrev: string,
  theme: VizTheme,
  index: number
): string {
  if (Object.hasOwn(palettes, abbrev)) return palettes[abbrev]["team-primary"];
  return theme.series[index % theme.series.length];
}

/** The one hook that reads the Tamagui theme. */
export function useVizTheme(): VizTheme {
  const theme = useTheme();
  const name = useThemeName();
  const values: Record<string, string> = {};
  for (const field of colourFields) {
    const token = theme[kebab(field)];
    if (!token) {
      // defect: contract.json and the Tamagui theme disagree
      throw new Error(`defect: Tamagui theme has no token ${kebab(field)}`);
    }
    values[kebab(field)] = String(token.val);
  }
  values[fontKeys.body] = String(
    getVariableValue(getConfig().fonts.body.family)
  );
  values[fontKeys.score] = String(
    getVariableValue(getConfig().fonts.score.family)
  );
  return vizTheme(values, name.startsWith("dark") ? "dark" : "light");
}
