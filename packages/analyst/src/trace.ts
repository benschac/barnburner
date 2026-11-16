import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TRACE_EVENT_TYPES = ["model_call", "tool_call", "verify", "card", "outcome"] as const;
export type TraceEventType = (typeof TRACE_EVENT_TYPES)[number];

export interface ModelCallEvent {
  readonly type: "model_call";
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
}

export interface ToolCallEvent {
  readonly type: "tool_call";
  readonly tool: string;
  readonly input: unknown;
  readonly output: string;
  readonly durationMs: number;
  readonly error?: string;
}

export interface VerifyEvent {
  readonly type: "verify";
  // Verifier check number, 1-8.
  readonly check: number;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface CardEvent {
  readonly type: "card";
  readonly cardId: string;
  readonly card: unknown;
}

export const OUTCOME_STATUSES = ["cards", "answered", "declined", "no_insight", "crashed"] as const;
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

export interface OutcomeEvent {
  readonly type: "outcome";
  readonly status: OutcomeStatus;
  readonly detail?: string;
}

// What callers pass to append(); the writer adds ts and runId.
export type TracePayload = ModelCallEvent | ToolCallEvent | VerifyEvent | CardEvent | OutcomeEvent;

export type TraceEvent = TracePayload & { readonly ts: string; readonly runId: string };

export const DEFAULT_MAX_TOOL_OUTPUT_CHARS = 2000;

const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Repo root is four levels up from src/ (packages/analyst/src -> repo root).
export function defaultTraceDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../.audit/agent-runs");
}

export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...[+${text.length - max} chars]`;
}

export interface TraceOptions {
  readonly runId: string;
  // Defaults to <repo root>/.audit/agent-runs. Tests pass a temp dir.
  readonly dir?: string;
  readonly now?: () => Date;
  readonly maxToolOutputChars?: number;
}

export interface TraceWriter {
  readonly runId: string;
  readonly path: string;
  append(payload: TracePayload): TraceEvent;
}

// Append-only JSONL writer: one line per event, written synchronously in call order.
export function openTrace(options: TraceOptions): TraceWriter {
  if (!RUN_ID_PATTERN.test(options.runId)) {
    throw new Error(`invalid runId for trace file: ${JSON.stringify(options.runId)}`);
  }
  const dir = options.dir ?? defaultTraceDir();
  const now = options.now ?? (() => new Date());
  const maxToolOutput = options.maxToolOutputChars ?? DEFAULT_MAX_TOOL_OUTPUT_CHARS;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${options.runId}.jsonl`);

  return {
    runId: options.runId,
    path,
    append(payload) {
      const event: TraceEvent =
        payload.type === "tool_call"
          ? { ...payload, output: truncateText(payload.output, maxToolOutput), ts: now().toISOString(), runId: options.runId }
          : { ...payload, ts: now().toISOString(), runId: options.runId };
      appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
      return event;
    },
  };
}

const REQUIRED_FIELDS: Record<TraceEventType, Record<string, "string" | "number" | "boolean" | "any">> = {
  model_call: { model: "string", inputTokens: "number", outputTokens: "number", latencyMs: "number" },
  tool_call: { tool: "string", input: "any", output: "string", durationMs: "number" },
  verify: { check: "number", passed: "boolean" },
  card: { cardId: "string", card: "any" },
  outcome: { status: "string" },
};

// Validates one JSONL line against the event shapes above. Throws on malformed input.
export function parseTraceLine(line: string): TraceEvent {
  const value: unknown = JSON.parse(line);
  if (typeof value !== "object" || value === null) throw new Error("trace line is not an object");
  const record = value as Record<string, unknown>;
  if (typeof record.ts !== "string" || typeof record.runId !== "string") {
    throw new Error("trace event missing ts or runId");
  }
  const type = record.type;
  if (typeof type !== "string" || !(TRACE_EVENT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`unknown trace event type: ${String(type)}`);
  }
  const fields = REQUIRED_FIELDS[type as TraceEventType];
  for (const [field, kind] of Object.entries(fields)) {
    const actual = record[field];
    if (kind === "any" ? actual === undefined : typeof actual !== kind) {
      throw new Error(`trace event ${type} has invalid field ${field}`);
    }
  }
  if (type === "outcome" && !(OUTCOME_STATUSES as readonly unknown[]).includes(record.status)) {
    throw new Error(`trace event outcome has invalid status ${String(record.status)}`);
  }
  return record as unknown as TraceEvent;
}
