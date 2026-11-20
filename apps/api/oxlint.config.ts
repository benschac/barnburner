import { defineConfig } from "oxlint";

import { node, ultracite } from "../../lint/oxlint.ts";

export default defineConfig({
  ...ultracite,
  extends: node,
  options: {
    typeAware: true,
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "typescript/no-floating-promises": "off",
      },
    },
  ],
});
