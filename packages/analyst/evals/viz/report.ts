// Bake-off report: one self-contained HTML page comparing vocabularies on the same prompts.
// bakeoffReport is pure: the caller supplies screenshots as data URIs. bakeoffReportFromFiles reads
// them from disk and fails with a tagged error when a file cannot be read.

import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import { Array as Arr, Effect, Order, Predicate, Schema } from "effect";

export type BakeoffOutcome = "Rendered" | "Failed";

// One result, as written by the bake-off runner (FE2).
export interface BakeoffRecord {
  readonly prompt: string;
  readonly dataset: string;
  readonly vocabulary: string;
  readonly outcome: BakeoffOutcome;
  readonly repairs: number;
  readonly model: string;
  readonly tokens: number;
  readonly firstPaintMs: number;
  readonly medianFps: number;
  readonly screenshotPath: string;
  readonly code: string;
}

export interface BakeoffReportOptions {
  // Screenshot path to image source (a data URI). A path with no entry shows a placeholder.
  readonly images?: ReadonlyMap<string, string>;
  // Source of the A/B order. Defaults to Math.random; tests pass a fixed source.
  readonly random?: () => number;
}

export class ScreenshotReadError extends Schema.TaggedError<
  ScreenshotReadError,
  { readonly brand: unique symbol }
>()("ScreenshotReadError", {
  path: Schema.String,
  reason: Schema.String,
}) {
  override get message(): string {
    return `cannot read screenshot ${this.path}: ${this.reason}`;
  }
}

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const median = (values: ReadonlyArray<number>): number => {
  const sorted = Arr.sort(values, Order.Number);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const mean = (values: ReadonlyArray<number>): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// A median over rendered results only; a dash when nothing rendered, so a failure never reads as a speed.
const medianOrDash = (values: ReadonlyArray<number>, digits: number): string =>
  values.length === 0 ? "—" : median(values).toFixed(digits);

// Fisher-Yates over a copy, so each prompt's A/B order is random but reproducible under a fixed source.
const shuffle = <T>(items: ReadonlyArray<T>, random: () => number): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const held = copy[index];
    copy[index] = copy[other];
    copy[other] = held;
  }
  return copy;
};

const labelFor = (index: number): string => String.fromCharCode(65 + index);

// Groups records by dataset and prompt, keeping first-seen order.
const groupByPrompt = (
  records: ReadonlyArray<BakeoffRecord>
): BakeoffRecord[][] => {
  const groups = new Map<string, BakeoffRecord[]>();
  for (const record of records) {
    const key = record.dataset + "\x00" + record.prompt;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [record]);
    else group.push(record);
  }
  return [...groups.values()];
};

const groupByVocabulary = (
  records: ReadonlyArray<BakeoffRecord>
): BakeoffRecord[][] => {
  const groups = new Map<string, BakeoffRecord[]>();
  for (const record of records) {
    const group = groups.get(record.vocabulary);
    if (group === undefined) groups.set(record.vocabulary, [record]);
    else group.push(record);
  }
  return [...groups.values()];
};

const renderPair = (
  group: ReadonlyArray<BakeoffRecord>,
  order: ReadonlyArray<BakeoffRecord>,
  images: ReadonlyMap<string, string>
): string => {
  const first = group[0];
  const sides = order
    .map((record, index) => {
      const label = labelFor(index);
      const image = images.get(record.screenshotPath);
      const picture =
        image === undefined
          ? '<p class="missing">No screenshot supplied.</p>'
          : '<img alt="Screenshot ' +
            label +
            '" src="' +
            escapeHtml(image) +
            '">';
      return (
        "<figure><figcaption>" +
        label +
        " · " +
        escapeHtml(record.outcome) +
        "</figcaption>" +
        picture +
        "</figure>"
      );
    })
    .join("");
  const note =
    group.length === 2
      ? ""
      : '<p class="missing">Expected two results for this prompt, found ' +
        group.length +
        ".</p>";
  return (
    '<section class="prompt"><h2>' +
    escapeHtml(first.dataset) +
    "</h2><p>" +
    escapeHtml(first.prompt) +
    "</p>" +
    note +
    '<div class="pair">' +
    sides +
    "</div></section>"
  );
};

const renderKey = (
  groups: ReadonlyArray<ReadonlyArray<BakeoffRecord>>,
  orders: ReadonlyArray<ReadonlyArray<BakeoffRecord>>
): string => {
  const items = groups
    .map((group, groupIndex) => {
      const assignments = orders[groupIndex]
        .map(
          (record, index) =>
            labelFor(index) + " = " + escapeHtml(record.vocabulary)
        )
        .join(", ");
      return (
        "<li>" + escapeHtml(group[0].dataset) + ": " + assignments + "</li>"
      );
    })
    .join("");
  return (
    '<details class="key"><summary>Key: which result was which</summary><ul>' +
    items +
    "</ul></details>"
  );
};

// The table names vocabularies and their rendered counts, so it sits inside a closed disclosure too.
const renderTable = (records: ReadonlyArray<BakeoffRecord>): string => {
  const rows = groupByVocabulary(records)
    .map((group) => {
      const rendered = group.filter((record) => record.outcome === "Rendered");
      return (
        '<tr><th scope="row">' +
        escapeHtml(group[0].vocabulary) +
        "</th>" +
        "<td>" +
        rendered.length +
        " of " +
        group.length +
        "</td>" +
        "<td>" +
        mean(group.map((record) => record.repairs)).toFixed(2) +
        "</td>" +
        "<td>" +
        Math.round(mean(group.map((record) => record.tokens))) +
        "</td>" +
        "<td>" +
        medianOrDash(
          rendered.map((record) => record.firstPaintMs),
          0
        ) +
        "</td>" +
        "<td>" +
        medianOrDash(
          rendered.map((record) => record.medianFps),
          1
        ) +
        "</td></tr>"
      );
    })
    .join("");
  return (
    '<details class="results"><summary>Results by vocabulary</summary><table><thead><tr>' +
    '<th scope="col">Vocabulary</th><th scope="col">Rendered</th>' +
    '<th scope="col">Repairs (mean)</th><th scope="col">Tokens (mean)</th>' +
    '<th scope="col">First paint, ms (median, rendered only)</th><th scope="col">Frame rate, fps (median, rendered only)</th>' +
    "</tr></thead><tbody>" +
    rows +
    "</tbody></table></details>"
  );
};

const styles = `:root{color-scheme:light dark}
body{font-family:system-ui,sans-serif;margin:2rem;color:CanvasText;background:Canvas}
.prompt{margin-bottom:2rem}.pair{display:flex;gap:1rem;flex-wrap:wrap}
figure{margin:0;flex:1 1 320px}figure img{width:100%;border:1px solid GrayText}
.missing{color:GrayText;font-style:italic}table{border-collapse:collapse;margin-top:1rem}
th,td{border:1px solid GrayText;padding:.4rem .6rem;text-align:left}details{margin-top:1rem}`;

// One HTML page. Each prompt shows its results side by side as A and B in a random order, with no
// vocabulary name outside the disclosures. The key and the results table sit at the bottom, closed.
export const bakeoffReport = (
  records: ReadonlyArray<BakeoffRecord>,
  options: BakeoffReportOptions = {}
): string => {
  const images = options.images ?? new Map<string, string>();
  const random = options.random ?? Math.random;
  const groups = groupByPrompt(records);
  const orders = groups.map((group) => shuffle(group, random));
  const pairs = groups
    .map((group, index) => renderPair(group, orders[index], images))
    .join("");
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bake-off report</title>' +
    "<style>" +
    styles +
    "</style></head><body><h1>Bake-off report</h1>" +
    pairs +
    renderKey(groups, orders) +
    renderTable(records) +
    "</body></html>"
  );
};

const mimeFor = (path: string): string => {
  const extension = extname(path).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
};

const readImage = (
  path: string
): Effect.Effect<readonly [string, string], ScreenshotReadError> =>
  Effect.tryPromise({
    try: () => readFile(path),
    catch: (cause) =>
      new ScreenshotReadError({
        path,
        reason: Predicate.isError(cause) ? cause.message : String(cause),
      }),
  }).pipe(
    Effect.map(
      (bytes) =>
        [
          path,
          "data:" + mimeFor(path) + ";base64," + bytes.toString("base64"),
        ] as const
    )
  );

// Reads each record's screenshot from disk, then builds the page. Any unreadable file fails the whole report.
export const bakeoffReportFromFiles = (
  records: ReadonlyArray<BakeoffRecord>,
  options: Omit<BakeoffReportOptions, "images"> = {}
): Effect.Effect<string, ScreenshotReadError> => {
  const paths = Arr.dedupe(records.map((record) => record.screenshotPath));
  return Effect.forEach(paths, readImage).pipe(
    Effect.map((entries) =>
      bakeoffReport(records, { ...options, images: new Map(entries) })
    )
  );
};
