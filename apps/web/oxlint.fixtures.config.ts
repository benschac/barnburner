import { defineConfig } from "oxlint";
import type { OxlintConfig } from "oxlint";

import production from "./oxlint.config.ts";

const fixtureGlob = (pattern: string): string =>
  pattern.startsWith("!")
    ? `!.lint-fixtures-web-*/${pattern.slice(1)}`
    : `.lint-fixtures-web-*/${pattern}`;

const fixtureOverride = (
  override: NonNullable<OxlintConfig["overrides"]>[number]
) => ({
  ...override,
  files: override.files.map(fixtureGlob),
  excludeFiles: override.excludeFiles?.map(fixtureGlob),
});

// Preserve production path-specific rules while keeping generated snippets outside application source.
export default defineConfig({
  ...production,
  overrides: production.overrides.map(fixtureOverride),
});
