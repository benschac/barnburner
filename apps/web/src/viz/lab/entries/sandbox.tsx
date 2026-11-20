import { ViewData } from "@nhl-reddit-stats/viz";
import type { FrameReport, LabEntry } from "@nhl-reddit-stats/viz";
import { samples } from "@nhl-reddit-stats/viz/samples";
import { Match, Predicate, Result, Schema } from "effect";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Text, View } from "tamagui";

import { VizFrameIsland } from "../../../islands/VizFrameIsland";

const toPrettyJson = Schema.encodeSync(
  Schema.fromJsonString(Schema.Unknown, { space: 2 })
);
const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const decodeViewData = Schema.decodeUnknownResult(
  Schema.fromJsonString(ViewData)
);

/** The view data text did not decode; `message` is the schema's diagnostic. */
class ViewDataInvalid extends Schema.TaggedError<
  ViewDataInvalid,
  { readonly brand: unique symbol }
>()("ViewDataInvalid", {
  message: Schema.String,
}) {}

const MESSAGES_SHOWN = 8;
const REPORTS_KEPT = 50;

const starterData = toPrettyJson({
  tables: samples.chain.tables,
  notes: samples.chain.notes,
});

// A hand-written view module for the chain sample. It draws each hop as a list item in the theme's colours.
const starter = [
  "export default function view({ root, tables, theme }) {",
  '  const list = document.createElement("ul")',
  "  list.style.color = theme.color",
  "  list.style.background = theme.background",
  "  list.style.fontFamily = theme.fonts.body",
  "  for (const hop of tables.hops) {",
  '    const item = document.createElement("li")',
  '    item.textContent = "chain " + hop.chain + " step " + hop.step + ": " + hop.from + " to " + hop.to + " (" + hop.games + " games)"',
  "    list.append(item)",
  "  }",
  "  root.append(list)",
  "  return () => list.remove()",
  "}",
].join("\n");

// Every report variant gets its own formatter, so a new one must be given a display here.
const describe = (report: FrameReport): string =>
  Match.valueTags(report, {
    Ready: () => "Ready",
    Rendered: ({ id, ms }) => `Rendered ${id} in ${ms} ms`,
    Failed: ({ id, message }) => `Failed ${id}: ${message}`,
    FrameRate: ({ id, fps }) => `FrameRate ${id}: ${fps}`,
  });

type Outcome = {
  reports: readonly FrameReport[];
  samples: number;
  fps: number | null;
};
const noOutcome: Outcome = { reports: [], samples: 0, fps: null };

function Sandbox() {
  const [draft, setDraft] = useState(starter);
  const [dataDraft, setDataDraft] = useState(starterData);
  const [code, setCode] = useState(starter);
  const [tables, setTables] = useState<ViewData["tables"]>(
    samples.chain.tables
  );
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState("");
  // The log is every recent message; the outcome is only what the frame reported for the render id this page sent.
  const [log, setLog] = useState<readonly string[]>([]);
  const [outcome, setOutcome] = useState<Outcome>(noOutcome);
  const renderId = useRef("");
  const run = () => {
    const decoded = decodeViewData(dataDraft);
    if (Result.isFailure(decoded)) {
      setProblem(
        new ViewDataInvalid({ message: decoded.failure.message }).message
      );
      return;
    }
    setProblem("");
    setTables(decoded.success.tables);
    setCode(draft);
    setAttempt((n) => n + 1);
  };
  const onRender = (id: string) => {
    renderId.current = id;
    setOutcome(noOutcome);
  };
  const onReport = (report: FrameReport) => {
    const rate = Predicate.isTagged(report, "FrameRate") ? report : undefined;
    if (!rate)
      setLog((previous) => [
        ...previous.slice(1 - MESSAGES_SHOWN),
        describe(report),
      ]);
    if (Predicate.isTagged(report, "Ready") || report.id !== renderId.current)
      return;
    setOutcome((previous) => ({
      reports: [...previous.reports.slice(1 - REPORTS_KEPT), report],
      samples: previous.samples + (rate ? 1 : 0),
      fps: rate ? rate.fps : previous.fps,
    }));
  };
  return (
    <View gap="3">
      <textarea
        aria-label="View module"
        rows={14}
        cols={90}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
      <textarea
        aria-label="View data"
        rows={8}
        cols={90}
        value={dataDraft}
        onChange={(event) => {
          setDataDraft(event.target.value);
        }}
      />
      <button type="button" aria-label="Run" onClick={run}>
        Run
      </button>
      {problem ? (
        <Text role="alert" fontFamily="body" color="color">
          {problem}
        </Text>
      ) : null}
      <VizFrameIsland
        code={code}
        tables={tables}
        attempt={attempt}
        onReport={onReport}
        onRender={onRender}
      />
      <Text fontFamily="body" color="color">
        {`Frame rate: ${outcome.fps ?? "none yet"} (samples: ${outcome.samples})`}
      </Text>
      <View render="ol" aria-label="Last messages">
        {log.map((line, index) => (
          <Text key={index} render="li" fontFamily="body" color="color">
            {line}
          </Text>
        ))}
      </View>
      <pre data-testid="frame-reports" hidden>
        {toJson(outcome.reports)}
      </pre>
    </View>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "Sandbox: a view module in the frame",
  render: () => <Sandbox />,
};

export default entry;
