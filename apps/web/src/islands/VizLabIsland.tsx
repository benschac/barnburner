"use client";

import "../fonts";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { Anchor, Text, View } from "tamagui";

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

const demos = [
  {
    name: "chain",
    title: "Teammate chains",
    description:
      "Pick any two players and follow the shortest teammate chains between them. Hover an edge to highlight its paths.",
  },
  {
    name: "search",
    title: "Player search",
    description:
      "Find the shortest chains between two players as teammates, opponents, or either, with season and competition filters.",
  },
  {
    name: "teammates",
    title: "Teammates",
    description:
      "Pick a player to see everyone they played with, as a list and a graph.",
  },
  {
    name: "games-by-season",
    title: "Shared games by season",
    description:
      "See how many games Connor McDavid and Leon Draisaitl played together, by season and competition.",
  },
  {
    name: "finals-grid",
    title: "Finals coverage",
    description:
      "See which Stanley Cup Finals from 1980–2026 included a teammate of Connor McDavid.",
  },
  {
    name: "network-bench",
    title: "Network renderer comparison",
    description:
      "Choose a renderer and sample dataset, then press Run to compare graph rendering performance.",
  },
];

function Lab({ name }: { name: string | undefined }) {
  const chosen = found.find((item) => item.name === name);
  return (
    <View render="main" w="100%" minH="100vh" gap="6" p="4" bg="background">
      <ThemeControls />
      <View gap="3">
        <Anchor
          render={<NextLink href="/" />}
          href="/"
          fontFamily="body"
          color="color"
        >
          ← Back to teams
        </Anchor>
        <Text
          render="h1"
          m="0"
          fontFamily="heading"
          fontSize="title"
          color="bright"
        >
          Graph lab
        </Text>
        <Text fontFamily="body" fontSize="body" color="muted">
          Chain, search and teammates query NHL history downloaded on 17
          November 2026. Shared games and Finals load a snapshot from that
          download and accept an uploaded export for other players; the renderer
          comparison uses synthetic samples.
        </Text>
      </View>
      <View
        render="nav"
        aria-label="Graph demos"
        gap="3"
        flexDirection="column md:row"
        flexWrap="wrap"
      >
        {demos.map((demo) => (
          <View
            key={demo.name}
            flex="unset md:1"
            minW="0"
            p="4"
            gap="2"
            bg="surface"
            rounded="md"
            borderWidth={1}
            borderColor={name === demo.name ? "gold" : "rule"}
          >
            <Anchor
              render={<NextLink href={`/viz-lab/${demo.name}`} />}
              href={`/viz-lab/${demo.name}`}
              aria-current={name === demo.name ? "page" : undefined}
              fontFamily="body"
              fontSize="label"
              color="bright"
            >
              {demo.title}
            </Anchor>
            <Text fontFamily="body" fontSize="body" color="muted">
              {demo.description}
            </Text>
          </View>
        ))}
      </View>
      {chosen ? (
        <View gap="3" minW="0" overflow="auto">
          <Text
            render="h2"
            m="0"
            fontFamily="heading"
            fontSize="label"
            color="bright"
          >
            {chosen.entry.title}
          </Text>
          {chosen.entry.render()}
        </View>
      ) : name ? (
        <Text role="status" fontFamily="body" color="color">
          Demo not found. Choose a graph above.
        </Text>
      ) : null}
      <details>
        <summary>More experiments and diagnostics</summary>
        <View render="nav" aria-label="Lab diagnostics" gap="3" py="3">
          {found
            .filter((item) => !demos.some((demo) => demo.name === item.name))
            .map((item) => (
              <Anchor
                key={item.name}
                render={
                  <NextLink
                    href={`/viz-lab/${encodeURIComponent(item.name)}`}
                  />
                }
                href={`/viz-lab/${encodeURIComponent(item.name)}`}
                aria-current={name === item.name ? "page" : undefined}
                fontFamily="body"
                color="color"
              >
                {item.entry.title}
              </Anchor>
            ))}
        </View>
      </details>
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
