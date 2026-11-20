import { stepCountIs } from "ai";
import type { StopCondition, ToolSet, ToolExecuteFunction } from "ai";

import { guardQuery } from "./guard.ts";
import type { Answer, Db } from "./shapes.ts";
import { makeAnswerTool } from "./tools/answer.ts";
import { makeDeclineTool } from "./tools/decline.ts";
import { executeOf } from "./tools/execute-of.ts";
import { makeSqlTool } from "./tools/sql.ts";
import type { ToolCallEvent } from "./trace.ts";

export const MAX_STEPS = 12;
export const makeToolset = (db: Db, team: string) => {
  let answer: Answer | undefined;
  const bounded: Db = {
    query: (sql, opts) =>
      db.query(sql, { ...opts, timeoutMs: 10_000, rowCap: 200 }),
    queryCanonical: (sql, opts) =>
      db.queryCanonical(sql, { ...opts, timeoutMs: 10_000, rowCap: 200 }),
  };
  const events: ToolCallEvent[] = [];
  const failedDurations = new Map<string, number[]>();
  let tracedSteps = 0;
  const traced =
    <I, C>(name: string, execute: ToolExecuteFunction<I, string, C>) =>
    async (
      input: I,
      options: Parameters<ToolExecuteFunction<I, string, C>>[1]
    ) => {
      const start = performance.now();
      let completed = false;
      try {
        const result = await execute(input, options);
        let output = "";
        if (typeof result === "string") output = result;
        else for await (const part of result) output = part;
        events.push({
          type: "tool_call",
          tool: name,
          input,
          output,
          durationMs: performance.now() - start,
          ...(output.startsWith("ERROR:") ? { error: output } : {}),
        });
        completed = true;
        return output;
      } finally {
        if (!completed) {
          const durations = failedDurations.get(options.toolCallId) ?? [];
          durations.push(performance.now() - start);
          failedDurations.set(options.toolCallId, durations);
        }
      }
    };
  const sql = makeSqlTool({ db: bounded, guard: guardQuery });
  const answerTool = makeAnswerTool({
    db: bounded,
    guard: guardQuery,
    team,
    onAnswer: (value) => {
      answer ??= value;
    },
  });
  const decline = makeDeclineTool({
    onDecline: (reason) => {
      answer ??= { _tag: "Declined", reason };
    },
  });
  const tools = {
    sql: { ...sql, execute: traced("sql", executeOf(sql.execute)) },
    answer: {
      ...answerTool,
      execute: traced("answer", executeOf(answerTool.execute)),
    },
    decline: {
      ...decline,
      execute: traced("decline", executeOf(decline.execute)),
    },
  };
  const stopWhen: StopCondition<ToolSet> = ({ steps }) => {
    for (const step of steps.slice(tracedSteps)) {
      for (const part of step.content) {
        if (part.type !== "tool-error") continue;
        const error = String(part.error);
        events.push({
          type: "tool_call",
          tool: part.toolName,
          input: part.input ?? null,
          output: `ERROR: ${error}`,
          error,
          durationMs: failedDurations.get(part.toolCallId)?.shift() ?? null,
        });
      }
    }
    tracedSteps = steps.length;
    if (answer !== undefined || stepCountIs(MAX_STEPS)({ steps })) return true;
    let failures = 0;
    for (const step of steps) {
      for (const part of step.content) {
        if (part.type === "tool-error") failures++;
        else if (part.type === "tool-result") {
          failures =
            typeof part.output === "string" && part.output.startsWith("ERROR:")
              ? failures + 1
              : 0;
        }
        if (failures >= 3) return true;
      }
    }
    return false;
  };
  return { tools, stopWhen, events, answer: () => answer };
};
