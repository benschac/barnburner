import { Result, Schema } from "effect";

import type { InsightCard, RejectReason } from "./card.ts";
import { render } from "./render.ts";
import type { Binding, Cell, RenderError, Row } from "./render.ts";

export class NotPendingError extends Schema.TaggedError<
  NotPendingError,
  { readonly brand: unique symbol }
>()("NotPendingError", {
  cardId: Schema.String,
  status: Schema.String,
}) {
  override get message(): string {
    return `card ${this.cardId} is ${this.status}, only pending cards can be reviewed`;
  }
}

export type Decision =
  | { readonly action: "approve" }
  | { readonly action: "reject"; readonly reason: RejectReason }
  | { readonly action: "skip" };

// Only pending cards can be decided; any other status fails with NotPendingError. Skip returns the card unchanged.
export const applyDecision = (
  card: InsightCard,
  decision: Decision,
  now: string
): Result.Result<InsightCard, NotPendingError> => {
  if (card.status !== "pending")
    return Result.fail(
      new NotPendingError({ cardId: card.id, status: card.status })
    );
  switch (decision.action) {
    case "approve": {
      return Result.succeed({
        ...card,
        status: "approved",
        review: { by: "ben", at: now },
      });
    }
    case "reject": {
      return Result.succeed({
        ...card,
        status: "rejected",
        review: { by: "ben", at: now, reason: decision.reason },
      });
    }
    case "skip": {
      return Result.succeed(card);
    }
  }
};

const cellText = (cell: Cell | undefined): string =>
  cell === null || cell === undefined ? "" : String(cell);

// Aligned plain-text table. Columns are the keys of all rows, in first-seen order.
export const formatTable = (rows: readonly Row[]): string => {
  if (rows.length === 0) return "(no rows)";
  const columns: string[] = [];
  for (const row of rows)
    for (const key of Object.keys(row))
      if (!columns.includes(key)) columns.push(key);
  const grid = rows.map((row) =>
    columns.map((column) => cellText(row[column]))
  );
  const widths = columns.map((column, i) =>
    Math.max(column.length, ...grid.map((line) => line[i]?.length ?? 0))
  );
  const line = (cells: readonly string[]) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join("  ")
      .trimEnd();
  return [
    line(columns),
    line(widths.map((w) => "-".repeat(w))),
    ...grid.map(line),
  ].join("\n");
};

// Fails with the render error when the headline or body does not render against the evidence.
export const formatForReview = (
  card: InsightCard
): Result.Result<string, RenderError> => {
  const bindings: Record<string, Binding> = card.bindings;
  const rows = card.evidence.result as Row[];
  const headline = render(card.headline, bindings, rows);
  if (Result.isFailure(headline)) return headline;
  const body = render(card.body, bindings, rows);
  if (Result.isFailure(body)) return body;
  const lines = [
    `[${card.id}] ${card.team} (${card.kind})`,
    headline.success,
    body.success,
    "",
    "Query:",
    card.evidence.query,
    "",
    `Result (${rows.length} rows):`,
    formatTable(rows),
    "",
    `gameIds: ${card.evidence.gameIds.join(", ") || "(none)"}`,
    card.evidence.coverage === undefined
      ? "coverage: (none)"
      : `coverage: ${card.evidence.coverage.archived}/${card.evidence.coverage.finals} archived`,
  ];
  if (card.assert !== undefined) lines.push(`assert: ${card.assert}`);
  return Result.succeed(lines.join("\n"));
};
