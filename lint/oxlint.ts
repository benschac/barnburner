// The configs every workspace's oxlint.config.ts extends.
//
// The house configs stay JSON (lint/*.oxlintrc.json), because check:node-scripts and lint:jev
// run oxlint on them directly. An oxlint.config.ts cannot extend a JSON path, and Oxlint refuses
// a relative jsPlugins specifier in a config passed through `extends`, so `json` reads one and
// makes its paths absolute.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExternalPluginEntry, OxlintConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

import { off, webOff } from "./ultracite.ts";

type JsonConfig = Omit<OxlintConfig, "extends"> & {
  readonly $schema?: string;
  readonly extends?: readonly string[];
};

const here = dirname(fileURLToPath(import.meta.url));

const absolute = (dir: string, specifier: string): string =>
  specifier.startsWith(".") ? resolve(dir, specifier) : specifier;

const plugin = (dir: string, entry: ExternalPluginEntry): ExternalPluginEntry =>
  typeof entry === "string"
    ? absolute(dir, entry)
    : { ...entry, specifier: absolute(dir, entry.specifier) };

/** Reads a .oxlintrc.json as a config object for `extends`, with its own `extends` read the same way. */
export const json = (path: string): OxlintConfig => {
  const dir = dirname(path);
  // JSON.parse has no schema to check against; Oxlint validates the config when it loads it.
  const {
    $schema: _schema,
    extends: parents,
    jsPlugins,
    ...config
  } = JSON.parse(readFileSync(path, "utf8")) as JsonConfig;
  return {
    ...config,
    extends: (parents ?? []).map((parent) => json(resolve(dir, parent))),
    jsPlugins: (jsPlugins ?? []).map((entry) => plugin(dir, entry)),
  };
};

/** The house rules: the Effect core module rules and the anti-slop rules. */
export const house: OxlintConfig[] = [
  json(resolve(here, "effect-core.oxlintrc.json")),
  json(resolve(here, "anti-slop.oxlintrc.json")),
];

/** Ultracite's `env` and `ignorePatterns`, which Oxlint does not inherit through `extends`. */
export const ultracite = { env: core.env, ignorePatterns: core.ignorePatterns };

/** Ultracite's core preset, then the rules turned off in lint/ultracite.ts, then the house rules, which win. */
export const node: OxlintConfig[] = [core, off, ...house];

/** `node` with Ultracite's React and Next.js presets, for apps/web. */
export const web: OxlintConfig[] = [core, react, next, off, webOff, ...house];
