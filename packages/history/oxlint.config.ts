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
      files: ["**/*.test.ts"],
      rules: {
        "typescript/no-floating-promises": "off",
      },
    },
  ],
});
