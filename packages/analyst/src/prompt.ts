import { readFileSync } from "node:fs";

import type { Coverage } from "./shapes.ts";

export type PromptInput = {
  readonly team: string;
  readonly views: Readonly<Record<string, readonly string[]>>;
  readonly coverage: Coverage;
  readonly posterFacts: readonly string[];
};

const template = readFileSync(
  new URL("prompts/generate.md", import.meta.url),
  "utf-8"
);

const renderSchemas = (views: PromptInput["views"]): string =>
  Object.entries(views)
    .map(([table, columns]) => `- \`${table}\`: ${columns.join(", ")}`)
    .join("\n");

const renderCoverage = (team: string, { finals, archived }: Coverage): string =>
  `${team} has ${finals} completed games, and ${archived} of them have archived box scores.`;

const renderFacts = (facts: PromptInput["posterFacts"]): string =>
  facts.length === 0
    ? "- (none supplied)"
    : facts.map((fact) => `- ${fact}`).join("\n");

export const buildPrompt = ({
  team,
  views,
  coverage,
  posterFacts,
}: PromptInput): string => {
  const values: Record<string, string> = {
    team,
    schemas: renderSchemas(views),
    coverage: renderCoverage(team, coverage),
    poster_facts: renderFacts(posterFacts),
  };
  return template.replaceAll(/\{\{(\w+)\}\}/g, (token, key: string) => {
    const value = values[key];
    if (value === undefined) {
      // defect: generate.md ships with this package; an unknown token is a programming error
      throw new Error(`generate.md has an unknown token ${token}`);
    }
    return value;
  });
};
