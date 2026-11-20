import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Result } from "effect";

import { logError } from "../../../lib/logger.mjs";
import { defaultTraceDir, parseTraceLine } from "../src/trace.ts";
import type {
  OutcomeStatus,
  TraceEvent,
  TraceLineError,
} from "../src/trace.ts";

export interface ModelUsage {
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface RunSummary {
  readonly events: number;
  readonly byType: Record<string, number>;
  readonly models: Record<string, ModelUsage>;
  readonly tokens: { readonly input: number; readonly output: number };
  readonly tools: {
    readonly calls: number;
    readonly errors: number;
    readonly byTool: Record<string, number>;
  };
  readonly verify: {
    readonly checks: number;
    readonly failed: number;
    readonly failuresByCheck: Record<string, number>;
  };
  readonly cards: number;
  readonly outcome: OutcomeStatus | undefined;
}

// Pure aggregation over parsed trace events. No I/O.
export function summarize(events: readonly TraceEvent[]): RunSummary {
  const byType: Record<string, number> = {};
  const models: Record<
    string,
    { calls: number; inputTokens: number; outputTokens: number }
  > = {};
  const toolsByName: Record<string, number> = {};
  const failuresByCheck: Record<string, number> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let toolCalls = 0;
  let toolErrors = 0;
  let checks = 0;
  let failed = 0;
  let cards = 0;
  let outcome: OutcomeStatus | undefined;

  for (const event of events) {
    byType[event.type] = (byType[event.type] ?? 0) + 1;
    switch (event.type) {
      case "model_call": {
        const usage = models[event.model] ?? {
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
        models[event.model] = {
          calls: usage.calls + 1,
          inputTokens: usage.inputTokens + event.inputTokens,
          outputTokens: usage.outputTokens + event.outputTokens,
        };
        inputTokens += event.inputTokens;
        outputTokens += event.outputTokens;
        break;
      }
      case "tool_call": {
        toolCalls += 1;
        toolsByName[event.tool] = (toolsByName[event.tool] ?? 0) + 1;
        if (event.error !== undefined) toolErrors += 1;
        break;
      }
      case "verify": {
        checks += 1;
        if (!event.passed) {
          failed += 1;
          const key = String(event.check);
          failuresByCheck[key] = (failuresByCheck[key] ?? 0) + 1;
        }
        break;
      }
      case "card": {
        cards += 1;
        break;
      }
      case "outcome": {
        outcome = event.status;
        break;
      }
    }
  }

  return {
    events: events.length,
    byType,
    models,
    tokens: { input: inputTokens, output: outputTokens },
    tools: { calls: toolCalls, errors: toolErrors, byTool: toolsByName },
    verify: { checks, failed, failuresByCheck },
    cards,
    outcome,
  };
}

export function formatSummary(runId: string, summary: RunSummary): string {
  const lines: string[] = [];
  lines.push(`Run ${runId}`);
  lines.push(`Events: ${summary.events} (${formatCounts(summary.byType)})`);
  lines.push(`Outcome: ${summary.outcome ?? "none"}`);
  lines.push(`Cards: ${summary.cards}`);
  lines.push(
    `Tokens: ${summary.tokens.input} in / ${summary.tokens.output} out`
  );
  for (const [model, usage] of Object.entries(summary.models)) {
    lines.push(
      `  ${model}: ${usage.calls} calls, ${usage.inputTokens} in / ${usage.outputTokens} out`
    );
  }
  lines.push(
    `Tool calls: ${summary.tools.calls} (${summary.tools.errors} errors)`
  );
  for (const [tool, count] of Object.entries(summary.tools.byTool))
    lines.push(`  ${tool}: ${count}`);
  lines.push(
    `Verify: ${summary.verify.failed} failed of ${summary.verify.checks} checks`
  );
  for (const [check, count] of Object.entries(summary.verify.failuresByCheck)) {
    lines.push(`  check ${check}: ${count} failed`);
  }
  return lines.join("\n");
}

function formatCounts(counts: Record<string, number>): string {
  return (
    Object.entries(counts)
      .map(([key, count]) => `${key} ${count}`)
      .join(", ") || "none"
  );
}

function parseArgs(argv: readonly string[]): { runId: string; dir: string } {
  let runId: string | undefined;
  let dir = defaultTraceDir();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dir") {
      const value = argv[i + 1];
      if (value === undefined) throw new Error("--dir needs a value");
      dir = value;
      i++;
    } else if (runId === undefined) {
      runId = arg;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  if (runId === undefined)
    throw new Error(
      "usage: node scripts/insights-report.ts <runId> [--dir <dir>]"
    );
  return { runId, dir };
}

// Parses every non-empty line; fails with the first line the trace format rejects.
export function parseTrace(
  text: string
): Result.Result<TraceEvent[], TraceLineError> {
  return Result.all(
    text
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map(parseTraceLine)
  );
}

function main(argv: readonly string[]): void {
  const { runId, dir } = parseArgs(argv);
  const path = join(dir, `${runId}.jsonl`);
  const events = parseTrace(readFileSync(path, "utf-8"));
  if (Result.isFailure(events)) {
    logError(events.failure.message);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${formatSummary(runId, summarize(events.success))}\n`);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
