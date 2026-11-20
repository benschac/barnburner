import type { BenchData, BenchRenderer, LabEntry } from "@nhl-reddit-stats/viz";
import { samples } from "@nhl-reddit-stats/viz/samples";
import { Result, Schema } from "effect";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { View } from "tamagui";
import type { TamaguiElement } from "tamagui";

import { useBenchRuns } from "../../../use-bench-runs.ts";
import type { BenchResult } from "../../bench/harness.ts";
import { benchDataFromTables } from "../../bench/stats.ts";
import { useVizTheme } from "../../theme.ts";

type RendererContext = {
  keys: () => string[];
  (key: string): Promise<{ default: BenchRenderer }>;
};
type WebpackRequire = {
  context: (
    directory: string,
    recursive: boolean,
    filter: RegExp,
    mode: "lazy"
  ) => RendererContext;
};

// Rooted at the bench folder, which always exists. 'lazy' lists the renderer files without importing
// them: each one becomes its own chunk, fetched when Run is pressed. Adding a renderer file is enough.
declare const require: WebpackRequire;
const context = require.context(
  "../../bench",
  true,
  /^\.\/renderers\/[^/]+\.ts$/,
  "lazy"
);
const renderers = context
  .keys()
  .map((key) => ({ id: key.replace(/^.*\//, "").replace(/\.ts$/, ""), key }));

const toPrettyJson = Schema.encodeSync(
  Schema.fromJsonString(Schema.Unknown, { space: 2 })
);

const egoData: BenchData = benchDataFromTables(samples.ego.tables);
const leagueData: BenchData = benchDataFromTables(samples.league.tables);

const Source = Schema.Literals(["ego", "league", "file"]);
type Source = typeof Source.Type;
const isSource = Schema.is(Source);

function BenchPage() {
  const theme = useVizTheme();
  const benchRuns = useBenchRuns();
  const root = useRef<TamaguiElement>(null);
  const latestFile = useRef(0);
  const [renderer, setRenderer] = useState(renderers[0]?.id ?? "");
  const [source, setSource] = useState<Source>("league");
  const [loaded, setLoaded] = useState<BenchData | undefined>(undefined);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<readonly BenchResult[]>([]);

  const selected =
    source === "ego" ? egoData : source === "league" ? leagueData : loaded;

  if (renderers.length === 0)
    return <p>No renderers found in src/viz/bench/renderers.</p>;

  const readInto = async (file: File, ticket: number) => {
    const outcome = await benchRuns.readFile(file);
    if (ticket !== latestFile.current) return;
    if (Result.isSuccess(outcome)) {
      setLoaded(outcome.success);
      setNote(
        `Loaded ${file.name}: ${outcome.success.nodes.length} nodes and ${outcome.success.links.length} links.`
      );
    } else {
      setNote(`Could not use ${file.name}: ${outcome.failure.message}`);
    }
  };

  // Each file choice invalidates the one before it at once; only the latest one to finish may set the dataset.
  const onFile = (files: FileList | null) => {
    const file = files?.[0];
    const ticket = ++latestFile.current;
    setLoaded(undefined);
    if (!file) return;
    setSource("file");
    setNote(`Reading ${file.name}`);
    void readInto(file, ticket);
  };

  const run = async () => {
    const chosen = renderers.find((item) => item.id === renderer);
    const data = selected;
    const element = root.current;
    if (!chosen || !data || !(element instanceof HTMLElement)) {
      setNote("Pick a renderer and a dataset first.");
      return;
    }
    setRunning(true);
    setNote(`Running ${chosen.id}`);
    try {
      const outcome = await benchRuns.run(
        chosen.id,
        () => context(chosen.key),
        data,
        theme,
        element
      );
      if (Result.isSuccess(outcome)) {
        setResults((previous) => [...previous, outcome.success]);
        setNote("");
      } else {
        setNote(
          `${outcome.failure.renderer} failed at ${outcome.failure.stage}: ${outcome.failure.message}`
        );
      }
    } catch (cause) {
      // foreign: a defect escaped the Effect; show it and keep Run usable
      setNote(`${chosen.id} failed unexpectedly: ${String(cause)}`);
    } finally {
      setRunning(false);
    }
  };

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
          onChange={(event) => {
            setRenderer(event.target.value);
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
          onChange={(event) => {
            if (isSource(event.target.value)) setSource(event.target.value);
          }}
        >
          <option value="ego">ego sample</option>
          <option value="league">league sample</option>
          <option value="file" disabled={!loaded}>
            loaded file
          </option>
        </select>
      </label>{" "}
      <label>
        File{" "}
        <input
          type="file"
          accept="application/json"
          onChange={(event) => {
            onFile(event.target.files);
          }}
        />
      </label>{" "}
      <button
        type="button"
        disabled={running || !selected}
        onClick={() => {
          void run();
        }}
      >
        Run (10 s)
      </button>
      <p>
        Dataset:{" "}
        {selected
          ? `${selected.nodes.length} nodes, ${selected.links.length} links`
          : "none loaded"}
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
