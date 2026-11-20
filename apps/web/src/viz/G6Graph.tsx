import { Renderer as WebGLRenderer } from "@antv/g-webgl";
import {
  ExtensionCategory,
  Graph,
  getExtension,
  register,
  type GraphData,
  type GraphOptions,
  type NodeOptions,
} from "@antv/g6";
import { ReactNode as G6ReactNode } from "@antv/g6-extension-react";
import { Predicate, Result } from "effect";
import { useCallback, useMemo, type ComponentType } from "react";
import {
  TamaguiProvider,
  View,
  getTokens,
  getVariableValue,
  styled,
} from "tamagui";

import { config } from "../../tamagui.config";
import { Copy } from "../components/team-poster/primitives";
import { useG6Graph } from "../use-g6-graph";
import { G6RenderError, DIMMED, HIGHLIGHTED } from "./g6-host";
import { g6Theme, useVizTheme } from "./theme";

export { G6RenderError };

// The G6 host (plan D6, section C-viz): mounts a graph for `{ nodes, edges }`, applies g6Theme, redraws on
// data or theme change, resizes with its container, and destroys the graph on unmount.

/** The data a node carries: the values its drawing reads. */
export type G6NodeData = Readonly<Record<string, string | number | boolean>>;

/** What a custom node component receives: the node's id and its `data`. */
export type G6NodeProps = { readonly id: string; readonly data: G6NodeData };

/** The graph heights, as size tokens of the design contract. */
export type G6GraphHeight = "hero" | "drawer";

// Heights are size tokens, so the design lint can check them.
const Frame = styled(View, {
  w: "100%",
  variants: {
    size: {
      hero: { h: "hero" },
      drawer: { h: "drawer" },
    },
  } as const,
});

const pixels = (height: G6GraphHeight): number =>
  Number(getVariableValue(getTokens().size[height]));

export type G6GraphProps = {
  readonly data: GraphData;
  readonly layout: "dagre" | "force";
  /** Drawn for each node in place of the default circle. */
  readonly node?: ComponentType<G6NodeProps>;
  readonly renderer?: "canvas" | "webgl";
  /** A `size` token of design/contract.json; the design rules accept no pixel count. */
  readonly height: G6GraphHeight;
  /** Called with the edge id when the pointer enters an edge, and with null when it leaves. */
  readonly onEdgeHover?: (edgeId: string | null) => void;
  /**
   * Edge ids to draw highlighted; while the list is non-empty every other edge is dimmed. Changing it sets
   * element states on the existing graph: no rebuild, no new layout.
   */
  readonly highlightedEdges?: ReadonlyArray<string>;
};

function webglAvailable(): boolean {
  const probe = document.createElement("canvas");
  return (
    probe.getContext("webgl2") !== null || probe.getContext("webgl") !== null
  );
}

const REACT_NODE = "react-node";
const REACT_NODE_SIZE: [number, number] = [180, 96];
const DEFAULT_NODE_SIZE: [number, number] = [28, 28];
/** Room kept around a node, for its label and a gap, when the force layout keeps nodes apart. */
const NODE_GAP = 24;

function registerReactNode() {
  if (getExtension(ExtensionCategory.NODE, REACT_NODE) === undefined)
    register(ExtensionCategory.NODE, REACT_NODE, G6ReactNode);
}

export function G6Graph({
  data,
  layout,
  node: NodeView,
  renderer = "canvas",
  height,
  onEdgeHover,
  highlightedEdges,
}: G6GraphProps) {
  const vizTheme = useVizTheme();
  // useVizTheme builds a new object each render; key on the values the graph reads.
  const themeKey = [
    vizTheme.mode,
    vizTheme.background,
    vizTheme.surface,
    vizTheme.rule,
    vizTheme.color,
    vizTheme.muted,
    vizTheme.brand,
  ].join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- themeKey stands for vizTheme
  const theme = useMemo(() => vizTheme, [themeKey]);
  const heightPx = pixels(height);
  const build = useCallback(
    (container: HTMLElement): Result.Result<Graph, G6RenderError> => {
      if (renderer === "webgl" && !webglAvailable()) {
        return Result.fail(
          new G6RenderError({
            stage: "webgl",
            message: "WebGL is not available in this browser.",
          })
        );
      }
      if (NodeView) registerReactNode();
      const colours = g6Theme(theme);
      const nodeSize = NodeView ? REACT_NODE_SIZE : DEFAULT_NODE_SIZE;
      // Force spacing follows the drawn node, so a card is kept clear of its neighbours as a dot is.
      const radius = Math.hypot(nodeSize[0], nodeSize[1]) / 2 + NODE_GAP;
      const nodeState = {
        active: { stroke: theme.brand, lineWidth: 2 },
        inactive: { opacity: 0.35 },
      };
      const nodeOptions: NodeOptions = NodeView
        ? {
            type: REACT_NODE,
            style: {
              size: REACT_NODE_SIZE,
              component: (datum: { id: string; data?: G6NodeData }) => (
                // G6 renders each node in its own React root, so it needs its own Tamagui provider.
                // isSubtreeRoot keeps its theme class off <html>, which AppTheme owns.
                <TamaguiProvider
                  config={config}
                  defaultTheme={theme.mode}
                  disableInjectCSS
                  isSubtreeRoot
                >
                  <NodeView id={datum.id} data={datum.data ?? {}} />
                </TamaguiProvider>
              ),
            },
            state: nodeState,
          }
        : {
            style: {
              ...colours.node.style,
              size: DEFAULT_NODE_SIZE[0],
              lineWidth: 1,
              labelText: (datum) => {
                const name = datum.data?.name;
                return Predicate.isString(name) ? name : String(datum.id);
              },
              labelFontFamily: theme.fonts.body,
            },
            state: nodeState,
          };
      const options: GraphOptions = {
        container,
        width: container.clientWidth,
        height: heightPx,
        background: colours.background,
        animation: false,
        padding: 24,
        data,
        node: nodeOptions,
        edge: {
          style: {
            ...colours.edge.style,
            lineWidth: 1,
            labelFontFamily: theme.fonts.body,
          },
          state: {
            active: { stroke: theme.brand, lineWidth: 2 },
            inactive: { opacity: 0.2 },
            [HIGHLIGHTED]: { stroke: theme.brand, lineWidth: 3 },
            [DIMMED]: { opacity: 0.2 },
          },
        },
        layout:
          layout === "dagre"
            ? { type: "dagre", rankdir: "LR", nodesep: 24, ranksep: 64 }
            : {
                type: "d3-force",
                animation: false,
                link: { distance: Math.max(140, radius * 2) },
                collide: { radius },
                manyBody: { strength: -300 },
              },
        behaviors: [
          "drag-canvas",
          "zoom-canvas",
          { type: "hover-activate", degree: 1 },
        ],
      };
      if (renderer === "webgl") options.renderer = () => new WebGLRenderer();
      return Result.succeed(new Graph(options));
    },
    [data, layout, NodeView, renderer, heightPx, theme]
  );
  const { root, failure } = useG6Graph(
    build,
    heightPx,
    onEdgeHover,
    highlightedEdges
  );

  // SAFETY: Tamagui types the ref for native views; on web the root is the HTMLElement the graph mounts into.
  return (
    <Frame ref={root as never} size={height}>
      {failure ? (
        <Copy color="muted" role="alert">
          This graph could not be drawn: {failure.message}
        </Copy>
      ) : null}
    </Frame>
  );
}
