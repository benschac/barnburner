import assert from "node:assert/strict";
import { test } from "node:test";

import type { VizTheme } from "@nhl-reddit-stats/viz";
import { pairSample } from "@nhl-reddit-stats/viz/samples";

import {
  gamesBySeason,
  gamesBySeasonRows,
} from "../src/viz/specs/games-by-season.ts";
import type {
  GamesBySeasonSpec,
  GamesFacetSpec,
} from "../src/viz/specs/games-by-season.ts";

// The shared-games result is the facet; anything else fails the test rather than being cast.
function facetOf(spec: GamesBySeasonSpec): GamesFacetSpec {
  if (spec.type !== "facetRect") assert.fail("expected a facet");
  return spec;
}

// Theme and club colours are placeholders: the spec must take every colour from its arguments.
const theme: VizTheme = {
  mode: "light",
  background: "theme-background",
  color: "theme-color",
  muted: "theme-muted",
  gold: "theme-gold",
  win: "theme-win",
  loss: "theme-loss",
  pending: "theme-pending",
  rule: "theme-rule",
  surface: "theme-surface",
  highlight: "theme-highlight",
  brand: "theme-brand",
  bright: "theme-bright",
  chartWin: "theme-chart-win",
  chartLoss: "theme-chart-loss",
  chartPositive: "theme-chart-positive",
  chartNegative: "theme-chart-negative",
  chartLine: "theme-chart-line",
  series: [
    "theme-chart-positive",
    "theme-chart-negative",
    "theme-gold",
    "theme-brand",
    "theme-chart-win",
    "theme-chart-loss",
    "theme-muted",
  ],
  fonts: { body: "body-font", score: "score-font" },
};
const clubColor = (abbrev: string, index: number) => `club-${abbrev}-${index}`;

const teams = [
  { teamId: 1, abbrev: "AAA", name: "Alpha" },
  { teamId: 2, abbrev: "BBB", name: "Bravo" },
];

test("pair sample: one season, one club, two games", () => {
  assert.deepEqual(gamesBySeasonRows(pairSample.tables), [
    {
      season: "1950–51",
      seasonId: 19501951,
      competition: "Regular season",
      club: "CCC",
      games: 2,
      goaliePartner: false,
      series: "CCC",
    },
  ]);
});

test("pair sample: a facet of stacked interval bars, colour set once on the facet", () => {
  const spec = facetOf(gamesBySeason(pairSample.tables, theme, clubColor));
  assert.equal(spec.type, "facetRect");
  assert.deepEqual(spec.encode, { x: "competition" });
  assert.deepEqual(spec.scale.x.domain, ["Regular season"]);
  assert.deepEqual(spec.scale.color, {
    type: "ordinal",
    domain: ["CCC"],
    range: ["club-CCC-0"],
  });
  assert.equal(spec.data.length, 1);
  const [child] = spec.children;
  assert.equal(child.type, "interval");
  assert.deepEqual(child.encode, { x: "season", y: "games", color: "series" });
  assert.deepEqual(child.transform, [{ type: "stackY" }]);
  assert.deepEqual(child.scale.x.domain, ["1950–51"]);
  assert.deepEqual(child.scale.color, spec.scale.color);
  assert.equal(child.legend.color.position, "top");
});

test("clubs are coloured by alphabetical position, even when first-seen order differs", () => {
  // BBB plays first (1950-51), AAA second: the facet domain and range must pair BBB with its own colour.
  const tables = {
    teams,
    spans: [
      {
        seasonId: 19501951,
        gameType: 2 as const,
        teamId: 2,
        link: "PlayedWith" as const,
        games: 2,
        firstGameId: 1,
      },
      {
        seasonId: 19511952,
        gameType: 2 as const,
        teamId: 1,
        link: "PlayedWith" as const,
        games: 3,
        firstGameId: 2,
      },
    ],
  };
  const spec = facetOf(gamesBySeason(tables, theme, clubColor));
  assert.deepEqual(spec.scale.color, {
    type: "ordinal",
    domain: ["AAA", "BBB"],
    range: ["club-AAA-0", "club-BBB-1"],
  });
  assert.deepEqual(spec.scale.x.domain, ["Regular season"]);
  const [child] = spec.children;
  assert.equal(child.scale.x.domain.length, 2);
  assert.deepEqual(child.scale.color, spec.scale.color);
});

test("playoff-only pairs: the only facet is Playoffs, and it is the first column", () => {
  const tables = {
    teams,
    spans: [
      {
        seasonId: 19501951,
        gameType: 3 as const,
        teamId: 1,
        link: "PlayedWith" as const,
        games: 2,
        firstGameId: 1,
      },
    ],
  };
  const spec = facetOf(gamesBySeason(tables, theme, clubColor));
  assert.deepEqual(spec.scale.x.domain, ["Playoffs"]);
  assert.deepEqual(
    gamesBySeasonRows(tables).map((row) => row.competition),
    ["Playoffs"]
  );
});

test("regular season and playoffs both present: regular season is the first column", () => {
  const tables = {
    teams,
    spans: [
      {
        seasonId: 19501951,
        gameType: 3 as const,
        teamId: 1,
        link: "PlayedWith" as const,
        games: 1,
        firstGameId: 2,
      },
      {
        seasonId: 19501951,
        gameType: 2 as const,
        teamId: 1,
        link: "PlayedWith" as const,
        games: 2,
        firstGameId: 1,
      },
    ],
  };
  assert.deepEqual(
    facetOf(gamesBySeason(tables, theme, clubColor)).scale.x.domain,
    ["Regular season", "Playoffs"]
  );
});

test("goalie-partner games form a muted series named in the colour scale", () => {
  const tables = {
    teams,
    spans: [
      {
        seasonId: 19501951,
        gameType: 2 as const,
        teamId: 1,
        link: "PlayedWith" as const,
        games: 3,
        firstGameId: 1,
      },
      {
        seasonId: 19501951,
        gameType: 2 as const,
        teamId: 2,
        link: "GoaliePartners" as const,
        games: 4,
        firstGameId: 2,
      },
    ],
  };
  const spec = facetOf(gamesBySeason(tables, theme, clubColor));
  assert.deepEqual(spec.scale.color, {
    type: "ordinal",
    domain: ["AAA", "BBB", "Goalie partners"],
    range: ["club-AAA-0", "club-BBB-1", "theme-muted"],
  });
  const [child] = spec.children;
  assert.equal(child.encode.color, "series");
  assert.equal(
    spec.data.find((row) => row.goaliePartner)?.series,
    "Goalie partners"
  );
});

test("no shared games: a text note in the theme muted colour, not a facet", () => {
  const spec = gamesBySeason({ teams, spans: [] }, theme, clubColor);
  assert.equal(spec.type, "text");
  if (spec.type !== "text") return;
  assert.equal(spec.data[0].text, "These two players never played together.");
  assert.deepEqual(spec.style, { fill: "theme-muted", textAlign: "center" });
});

test("the facet reserves room for its axes, and only the left-most facet carries the y title and ticks", () => {
  const spec = facetOf(gamesBySeason(pairSample.tables, theme, clubColor));
  assert.ok(spec.paddingLeft > 0 && spec.paddingBottom > 0);
  const yAxis = spec.children[0].axis.y;
  const rows = [{}];
  assert.deepEqual(yAxis({ columnIndex: 0 }, rows), { title: "Games" });
  assert.deepEqual(yAxis({ columnIndex: 1 }, rows), {
    title: false,
    tick: null,
    label: null,
  });
  assert.deepEqual(yAxis({ columnIndex: 1 }, []), {
    title: false,
    tick: null,
    label: null,
    grid: null,
  });
});
