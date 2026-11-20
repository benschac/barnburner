"use client";

import "../fonts";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import type { ReactNode } from "react";
import { Text, View } from "tamagui";

import { AppTheme, ThemeControls } from "../ThemePreference";

type WebpackContext = {
  keys: () => string[];
  (key: string): { default: LabEntry<ReactNode> };
};
type WebpackRequire = {
  context: (
    directory: string,
    recursive: boolean,
    filter: RegExp
  ) => WebpackContext;
};

// Webpack bundles every file in the folder, so adding an entry file is enough.
declare const require: WebpackRequire;
const entries = require.context("../viz/lab/entries", false, /\.tsx$/);
const found = entries.keys().map((key) => ({
  name: key.replace(/^\.\//, "").replace(/\.tsx$/, ""),
  entry: entries(key).default,
}));

function Lab({ name }: { name: string | undefined }) {
  const chosen = found.find((item) => item.name === name);
  return (
    <View w="100%" gap="3" p="4" bg="background">
      <ThemeControls />
      <View render="nav" aria-label="Lab entries" gap="2">
        {found.map((item) => (
          <a key={item.name} href={`/viz-lab/${encodeURIComponent(item.name)}`}>
            <Text fontFamily="body" color="color">
              {item.entry.title}
            </Text>
          </a>
        ))}
      </View>
      {chosen ? <View>{chosen.entry.render()}</View> : null}
    </View>
  );
}

// The page loads this island in the browser only: the theme code reads localStorage and matchMedia,
// and fonts.ts builds FontFace objects at import.
export default function VizLabIsland({ entry }: { entry: string | undefined }) {
  return (
    <AppTheme>
      <Lab name={entry} />
    </AppTheme>
  );
}

export { VizLabIsland };
