import { test } from "node:test";
import assert from "node:assert/strict";
import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

test("ai sdk: generateText runs against the mock model without network", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: "Hello, world!" }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
  const result = await generateText({ model, prompt: "Hello, test!" });
  assert.equal(result.text, "Hello, world!");
  assert.equal(model.doGenerateCalls.length, 1);
});
