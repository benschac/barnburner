import { fileURLToPath } from "node:url";

import { createBuilder } from "@content-collections/core";

const config = fileURLToPath(
  new URL("../content-collections.ts", import.meta.url)
);
const builder = await createBuilder(config);
const errors: string[] = [];
builder.on("_error", (event) => errors.push(event.error.message));
await builder.build();
if (errors.length)
  throw new Error("Plan content failed to compile:\n" + errors.join("\n"));
const { renderAnalystPlan } = await import("../plan-viewer/render-plan.ts");
await renderAnalystPlan();
