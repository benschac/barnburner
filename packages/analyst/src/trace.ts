import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { DateTime, Result, Schema, Tuple } from "effect";

import { toJson } from "./json.ts";

export class InvalidRunIdError extends Schema.TaggedError<
  InvalidRunIdError,
  { readonly brand: unique symbol }
>()("InvalidRunIdError", {
  runId: Schema.String,
}) {
  override get message(): string {
    return `invalid runId for trace file: ${toJson(this.runId)}`;
  }
}

// A JSONL line that is not valid JSON or does not decode as a trace event.
export class TraceLineError extends Schema.TaggedError<
  TraceLineError,
  { readonly brand: unique symbol }
>()("TraceLineError", {
  reason: Schema.String,
  line: Schema.String,
}) {
  override get message(): string {
    return `invalid trace line: ${this.reason}`;
  }
}

// One schema per trace event. The writer and the reader both validate against these,
// so a line the writer persists is always a line the reader accepts.

export const TRACE_EVENT_TYPES = [
  "model_call",
  "tool_call",
  "verify",
  "card",
  "outcome",
] as const;
export type TraceEventType = (typeof TRACE_EVENT_TYPES)[number];

export const OUTCOME_STATUSES = [
  "cards",
  "answered",
  "declined",
  "no_insight",
  "crashed",
] as const;
export const OutcomeStatus = Schema.Literals(OUTCOME_STATUSES);
export type OutcomeStatus = typeof OutcomeStatus.Type;

// Unknown alone accepts undefined, which JSON.stringify drops; require a value.
const JsonValue = Schema.Unknown.check(
  Schema.makeFilter((value) => value !== undefined, {
    expected: "a JSON value",
  })
);

export const ModelCallEvent = Schema.Struct({
  type: Schema.Literal("model_call"),
  model: Schema.String,
  inputTokens: Schema.Finite,
  outputTokens: Schema.Finite,
  latencyMs: Schema.Finite,
});
export type ModelCallEvent = typeof ModelCallEvent.Type;

export const ToolCallEvent = Schema.Struct({
  type: Schema.Literal("tool_call"),
  tool: Schema.String,
  input: JsonValue,
  output: Schema.String,
  durationMs: Schema.NullOr(Schema.Finite),
  error: Schema.optionalKey(Schema.String),
});
export type ToolCallEvent = typeof ToolCallEvent.Type;

export const VerifyEvent = Schema.Struct({
  type: Schema.Literal("verify"),
  // Verifier check number, 1-8.
  check: Schema.Finite,
  passed: Schema.Boolean,
  detail: Schema.optionalKey(Schema.String),
});
export type VerifyEvent = typeof VerifyEvent.Type;

export const CardEvent = Schema.Struct({
  type: Schema.Literal("card"),
  cardId: Schema.String,
  card: JsonValue,
});
export type CardEvent = typeof CardEvent.Type;

export const OutcomeEvent = Schema.Struct({
  type: Schema.Literal("outcome"),
  status: OutcomeStatus,
  detail: Schema.optionalKey(Schema.String),
});
export type OutcomeEvent = typeof OutcomeEvent.Type;

// What callers pass to append(); the writer adds ts and runId.
export const TracePayload = Schema.Union([
  ModelCallEvent,
  ToolCallEvent,
  VerifyEvent,
  CardEvent,
  OutcomeEvent,
]);
export type TracePayload = typeof TracePayload.Type;

const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// Run IDs become file names, so they cannot contain path separators or start with a dot.
export const RunId = Schema.String.check(Schema.isPattern(RUN_ID_PATTERN));

// A persisted event is a payload plus the envelope the writer adds.
export const TraceEvent = TracePayload.mapMembers(
  Tuple.map(Schema.fieldsAssign({ ts: Schema.String, runId: RunId }))
);
export type TraceEvent = typeof TraceEvent.Type;

// Every event schema must be listed in TRACE_EVENT_TYPES and vice versa.
const _typesMatch: [TraceEventType, TracePayload["type"]] extends [
  TracePayload["type"],
  TraceEventType,
]
  ? true
  : never = true;
void _typesMatch;

const decodeTraceLine = Schema.decodeUnknownResult(
  Schema.fromJsonString(TraceEvent)
);

export const DEFAULT_MAX_TOOL_OUTPUT_CHARS = 2000;

// Repo root is four levels up from src/ (packages/analyst/src -> repo root).
export function defaultTraceDir(): string {
  return resolve(import.meta.dirname, "../../../.audit/agent-runs");
}

export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...[+${text.length - max} chars]`;
}

export type TraceOptions = {
  readonly runId: string;
  // Defaults to <repo root>/.audit/agent-runs. Tests pass a temp dir.
  readonly dir?: string;
  readonly now?: () => Date;
  readonly maxToolOutputChars?: number;
};

export type TraceWriter = {
  readonly runId: string;
  readonly path: string;
  // Fails, and writes nothing, when the event would serialize to a line the reader rejects.
  append(payload: TracePayload): Result.Result<TraceEvent, TraceLineError>;
};

// Append-only JSONL writer: one line per event, written synchronously in call order.
export function openTrace(
  options: TraceOptions
): Result.Result<TraceWriter, InvalidRunIdError> {
  if (!Schema.is(RunId)(options.runId)) {
    return Result.fail(new InvalidRunIdError({ runId: options.runId }));
  }
  const dir = options.dir ?? defaultTraceDir();
  const now = options.now ?? (() => DateTime.toDateUtc(DateTime.nowUnsafe()));
  const maxToolOutput =
    options.maxToolOutputChars ?? DEFAULT_MAX_TOOL_OUTPUT_CHARS;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${options.runId}.jsonl`);

  return Result.succeed({
    runId: options.runId,
    path,
    append(payload) {
      const event: TraceEvent =
        payload.type === "tool_call"
          ? {
              ...payload,
              output: truncateText(payload.output, maxToolOutput),
              ts: now().toISOString(),
              runId: options.runId,
            }
          : { ...payload, ts: now().toISOString(), runId: options.runId };
      // Decode the serialized line, not the object: JSON drops undefined and turns NaN into null,
      // and only the round trip catches what the reader would see.
      const line = toJson(event);
      const parsed = parseTraceLine(line);
      if (Result.isFailure(parsed)) return parsed;
      appendFileSync(path, `${line}\n`, "utf-8");
      return Result.succeed(event);
    },
  });
}

// Decodes one JSONL line against the event schemas. Fails with TraceLineError on malformed input.
export function parseTraceLine(
  line: string
): Result.Result<TraceEvent, TraceLineError> {
  return Result.mapError(
    decodeTraceLine(line),
    (error) => new TraceLineError({ reason: error.message, line })
  );
}
