import { Chart } from "@antv/g2";
import type { G2Spec } from "@antv/g2";
import { Predicate } from "effect";

import type { g2Theme } from "./theme";

export type G2Theme = ReturnType<typeof g2Theme>;

// G2 merges options into the chart and mutates nested objects, so every draw gets its own copy.
function cloneSpec<T>(value: T): T {
  if (Array.isArray(value)) {
    // SAFETY: the copy has the same elements, each cloned, as the array it came from.
    return value.map(cloneSpec) as T;
  }
  if (
    Predicate.isObject(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    // SAFETY: the copy has the same keys, each value cloned, as the plain object it came from.
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneSpec(item)])
    ) as T;
  }
  return value;
}

// G2 resolves `theme` per view and a child view that has none falls back to the built-in light theme, so a facet's
// axes would be light-theme text (black at 0.45 opacity) on a dark chart. Give every child the theme.
function withTheme<T>(node: T, theme: G2Theme): T {
  if (!Predicate.isObject(node)) return node;
  const children = node.children;
  if (!Array.isArray(children)) return node;
  const themedChildren = children.map((child) => {
    const themed = withTheme(child, theme);
    if (!Predicate.isObject(themed) || Object.hasOwn(themed, "theme"))
      return themed;
    return { ...themed, theme };
  });
  // SAFETY: only the children list changed, and each child is the same value with a theme added.
  return { ...node, children: themedChildren };
}

/**
 * Builds the chart in `container` from the spec as G2 takes it: a copy with the theme on every child view.
 * The size is the measured width of the container and `heightPx`, applied after the spec.
 */
export function createChart(
  container: HTMLElement,
  spec: G2Spec,
  theme: G2Theme,
  heightPx: number
): Chart {
  const instance = new Chart({
    container,
    width: container.clientWidth,
    height: heightPx,
  });
  const themed: G2Spec = withTheme(cloneSpec(spec), theme);
  instance.options({
    ...themed,
    theme,
    autoFit: false,
    width: container.clientWidth,
    height: heightPx,
  });
  return instance;
}
