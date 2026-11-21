import {
  defineApp,
  mutation,
  object,
  query,
  router,
  type MutationContext,
  type QueryContext,
} from "apps";

import { recentChecks, runCheck } from "./health.js";
import { Checks } from "./schema.js";

export const history = query(
  {
    input: object({}),
    output: Checks,
    description: "Read the 100 most recent saved NHL source observations.",
  },
  async (ctx: QueryContext<{}>) => recentChecks(ctx.sql)
);
export const checkNow = mutation(
  {
    input: object({}),
    output: Checks,
    description:
      "Read public NHL standings and scores, then save observations in this app only. Does not modify NHL data.",
  },
  async (ctx: MutationContext<{}>) => runCheck(ctx)
);
export default defineApp({}, { tools: router({ history, checkNow }) });
