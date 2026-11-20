import { defineConfig } from "oxlint";

import { node, ultracite } from "../../lint/oxlint.ts";

export default defineConfig({
  ...ultracite,
  extends: node,
  jsPlugins: ["../../lint/union-model-plugin.mjs"],
  rules: {
    "unions/discriminated": "error",
    "unions/no-in-narrowing": "error",
  },
  options: {
    typeAware: true,
  },
  overrides: [
    {
      // These take a model's tool arguments or a card read from disk and decode it with a schema
      // as their first step, so `unknown` is the honest parameter type.
      files: [
        "src/tools/answer.ts",
        "src/tools/decline.ts",
        "src/tools/submit-card.ts",
        "src/verify.ts",
        "src/verify-static.ts",
        "src/shapes.ts",
      ],
      rules: {
        "anti-slop/no-unknown-parameters": "off",
      },
    },
    {
      files: ["**/*.test.ts"],
      rules: {
        "typescript/no-floating-promises": "off",
      },
    },
  ],
});
