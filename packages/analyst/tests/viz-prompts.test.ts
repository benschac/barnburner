import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { checkViewCode } from "@nhl-reddit-stats/viz/check-view-code";

const read = (name: string): string =>
  readFileSync(new URL("../src/prompts/" + name, import.meta.url), "utf8");

// The example module is the last fenced js block in the prompt.
const lastModule = (markdown: string): string => {
  const blocks = [...markdown.matchAll(/```js\n([\s\S]*?)```/g)].map(
    (match) => match[1] ?? ""
  );
  const last = blocks[blocks.length - 1];
  // defect: a prompt without its example module is a programming error
  if (last === undefined) throw new Error("no js block in the prompt");
  return last;
};

for (const name of ["view-antv.md", "view-d3.md"]) {
  test(name + " ends with an example module that passes checkViewCode", () => {
    const markdown = read(name);
    const code = lastModule(markdown);
    assert.ok(
      markdown.trimEnd().endsWith("```"),
      "the example is the last thing in the prompt"
    );
    assert.match(code, /^export default function render\(ctx\)/);
    assert.deepEqual(checkViewCode(code), []);
  });

  test(name + " states the contract, the theme fields, and the rules", () => {
    const markdown = read(name);
    for (const field of [
      "root",
      "tables",
      "theme",
      "size",
      "libs",
      "series",
      "chartPositive",
      "fonts",
      "notes",
      "sampleRows",
    ]) {
      assert.ok(markdown.includes(field), name + " mentions " + field);
    }
    for (const rule of [
      "No `import`",
      "No network",
      "cleanup",
      "colour literal",
    ]) {
      assert.ok(markdown.includes(rule), name + " states: " + rule);
    }
  });
}

test("view-antv.md names G2 and G6 first, and view-d3.md allows only D3 and Three.js", () => {
  const antv = read("view-antv.md");
  const rule = antv
    .split("\n")
    .find((line) => line.startsWith("10. Pick the library"));
  assert.ok(rule !== undefined, "the prompt has the selection rule");
  const at = (needle: string): number => rule.indexOf(needle);
  for (const first of ["ctx.libs.G2", "ctx.libs.G6"]) {
    for (const later of ["ctx.libs.d3", "ctx.libs.THREE"]) {
      assert.ok(
        at(first) >= 0 && at(later) >= 0 && at(first) < at(later),
        first + " is named before " + later + " in the selection rule"
      );
    }
  }
  assert.ok(
    antv.includes("no per-club colours") &&
      read("view-d3.md").includes("no per-club colours")
  );
  assert.ok(antv.includes("G2 5.4.8") && antv.includes("G6 5.1.1"));
  assert.match(
    read("view-d3.md"),
    /Use only `ctx\.libs\.d3` and `ctx\.libs\.THREE`/
  );
});
