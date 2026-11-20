import { defineConfig } from "oxlint";

import { node, ultracite } from "../../lint/oxlint.ts";

export default defineConfig({
  ...ultracite,
  extends: node,
  jsPlugins: ["../../lint/union-model-plugin.mjs"],
  rules: {
    "unions/discriminated": "error",
    "unions/no-in-narrowing": "error",
    "typescript/switch-exhaustiveness-check": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/await-thenable": "error",
    "typescript/no-non-null-assertion": "error",
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
