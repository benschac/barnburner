import { tool, jsonSchema } from "ai";
import { Effect, Schema } from "effect";

import { checkWith } from "../json.ts";

export type DeclineDeps = {
  readonly onDecline: (reason: string) => void;
};

const DeclineInputSchema = Schema.Struct({
  reason: Schema.String.annotate({
    message: "reason must be a non-empty string",
  }).check(
    Schema.makeFilter(
      (reason) => reason.trim() !== "" || "reason must be a non-empty string"
    )
  ),
}).annotate({ message: "input must be an object" });

export type DeclineInput = {
  readonly reason: string;
};

// Runtime check of model-supplied arguments. Wrong types are reported, never coerced.
export const checkDeclineInput = checkWith(DeclineInputSchema);

// Returns "ok", or "ERROR: <reason>" when the arguments are invalid.
export const runDecline = (
  deps: DeclineDeps,
  raw: unknown
): Effect.Effect<string> =>
  Effect.sync(() => {
    const checked = checkDeclineInput(raw);
    if (!checked.ok) return `ERROR: ${checked.reason}`;
    deps.onDecline(checked.input.reason.trim());
    return "ok";
  });
export const declineTool = (deps: DeclineDeps) =>
  tool({
    description:
      "Decline the question because it is out of scope or cannot be answered from the available data. Give a short reason.",
    inputSchema: jsonSchema<DeclineInput>(
      {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Why the question cannot be answered.",
          },
        },
        required: ["reason"],
        additionalProperties: false,
      },
      {
        validate: (value) => {
          const checked = checkDeclineInput(value);
          return checked.ok
            ? { success: true, value: { reason: checked.input.reason.trim() } }
            : { success: false, error: new Error(checked.reason) };
        },
      }
    ),
    execute: (input, { abortSignal }) =>
      Effect.runPromise(runDecline(deps, input), { signal: abortSignal }),
  });

export const makeDeclineTool = declineTool;
