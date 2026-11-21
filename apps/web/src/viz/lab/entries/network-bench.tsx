import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Option, Schema } from "effect";
import type { ReactNode } from "react";
import { View } from "tamagui";

import { useBenchMachine } from "../../../use-bench-machine.ts";
import {
  BenchSource,
  canRun,
  selectedData,
} from "../../bench/bench-machine.ts";
import { rendererLoaders } from "../../bench/renderer-loaders.ts";
import { useVizTheme } from "../../theme.ts";

const renderers = rendererLoaders;

const toPrettyJson = Schema.encodeSync(
  Schema.fromJsonString(Schema.Unknown, { space: 2 })
);

const isSource = Schema.is(BenchSource);

function BenchPage() {
  const theme = useVizTheme();
  const { snapshot, root, send } = useBenchMachine(renderers);

  if (renderers.length === 0)
    return <p>No renderers found in src/viz/bench/renderers.</p>;
  if (!snapshot) return null;

  const { renderer, source, loaded, note, results } = snapshot.context;
  const selected = selectedData(snapshot.context);
  // A run, or a read of a file, owns the controls until it ends.
  const running = snapshot.matches("running");

  return (
    <section>
      <p>
        {renderers.length} renderer{renderers.length === 1 ? "" : "s"} found:{" "}
        {renderers.map((item) => item.id).join(", ")}.
      </p>
      <label>
        Renderer{" "}
        <select
          value={renderer}
          disabled={running}
          onChange={(event) => {
            send({ type: "SelectRenderer", renderer: event.target.value });
          }}
        >
          {renderers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        Dataset{" "}
        <select
          value={source}
          disabled={running}
          onChange={(event) => {
            const chosen = event.target.value;
            if (isSource(chosen))
              send({ type: "SelectSource", source: chosen });
          }}
        >
          <option value="ego">ego sample</option>
          <option value="league">league sample</option>
          <option value="file" disabled={loaded === null}>
            loaded file
          </option>
        </select>
      </label>{" "}
      <label>
        File{" "}
        <input
          type="file"
          accept="application/json"
          disabled={running}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) send({ type: "PickFile", file });
          }}
        />
      </label>{" "}
      <button
        type="button"
        disabled={!snapshot.matches("idle") || !canRun(snapshot.context)}
        onClick={() => {
          send({ type: "Run", theme });
        }}
      >
        Run (10 s)
      </button>
      <p>
        Dataset:{" "}
        {Option.match(selected, {
          onNone: () => "none loaded",
          onSome: (data) =>
            `${data.nodes.length} nodes, ${data.links.length} links`,
        })}
        .
      </p>
      <p role="status">{note}</p>
      <View ref={root} w="drawer" h="drawer" bg="background" />
      <p>
        Settle time is the renderer&apos;s own settle signal: the time until its
        mount() resolved.
      </p>
      <table>
        <thead>
          <tr>
            <th>renderer</th>
            <th>nodes</th>
            <th>links</th>
            <th>settle (ms)</th>
            <th>frames</th>
            <th>median fps</th>
            <th>worst fps</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, index) => (
            <tr key={index}>
              <td>{result.renderer}</td>
              <td>{result.nodes}</td>
              <td>{result.links}</td>
              <td>{result.settleMs.toFixed(0)}</td>
              <td>{result.frames}</td>
              <td>{result.medianFps.toFixed(1)}</td>
              <td>{result.worstFps.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length > 0 ? (
        <details>
          <summary>JSON</summary>
          <pre>{toPrettyJson(results)}</pre>
        </details>
      ) : null}
    </section>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "Network bench: renderer speed",
  render: () => <BenchPage />,
};

export default entry;
