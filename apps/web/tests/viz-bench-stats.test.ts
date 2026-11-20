import assert from "node:assert/strict";
import { test } from "node:test";

import { samples } from "@nhl-reddit-stats/viz/samples";
import { Match, Result } from "effect";

import {
  benchDataFromTables,
  benchScript,
  decodeBenchText,
  frameRates,
  median,
  overlaps,
  scriptMs,
  summarize,
  validateBench,
  worst,
} from "../src/viz/bench/stats.ts";

test("median of odd, even, and empty lists", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), 0);
});

test("worst is the lowest rate, 0 when empty", () => {
  assert.equal(worst([60, 30, 59]), 30);
  assert.equal(worst([]), 0);
});

test("frameRates turns gaps into rates and skips equal times", () => {
  assert.deepEqual(frameRates([0, 10, 20, 20, 70]), [100, 100, 20]);
  assert.deepEqual(frameRates([5]), []);
});

test("summarize reports the median and the worst frame rate", () => {
  const summary = summarize([0, 10, 20, 70]);
  assert.equal(summary.frames, 4);
  assert.equal(summary.medianFps, 100);
  assert.equal(summary.worstFps, 20);
});

test("the script spans ten seconds in contiguous one-second steps, and the zooms cancel out", () => {
  const script = benchScript();
  assert.equal(script.length, scriptMs / 1000);
  script.forEach((step, index) => {
    assert.equal(step.fromMs, index * 1000);
    assert.equal(step.toMs, step.fromMs + 1000);
  });
  const logScale = script.reduce(
    (total, step) =>
      total +
      Match.valueTags(step, {
        pan: () => 0,
        zoom: (zoom) =>
          Math.log(zoom.factorPerSecond) * ((zoom.toMs - zoom.fromMs) / 1000),
      }),
    0
  );
  assert.ok(Math.abs(logScale) < 1e-9);
  assert.ok(script.some((step) => step._tag === "pan"));
});

test("overlaps gives the milliseconds of each step inside a window", () => {
  const script = benchScript();
  assert.deepEqual(
    overlaps(script, 500, 1500).map(({ step, ms }) => [step.fromMs, ms]),
    [
      [0, 500],
      [1000, 500],
    ]
  );
  assert.deepEqual(
    overlaps(script, 0, scriptMs).map(({ ms }) => ms),
    Array.from({ length: 10 }, () => 1000)
  );
  assert.equal(overlaps(script, 100, 100).length, 0);
  assert.equal(overlaps(script, scriptMs, scriptMs + 50).length, 0);
});

for (const name of ["ego", "league"] as const) {
  const { tables } = samples[name];

  test(`${name} export maps players to nodes and links to links`, () => {
    const data = benchDataFromTables(tables);
    assert.equal(data.nodes.length, tables.players.length);
    assert.equal(data.links.length, tables.links.length);
    assert.deepEqual(data.nodes[0], {
      playerId: tables.players[0].playerId,
      name: tables.players[0].name,
      games: tables.players[0].games,
    });
    assert.deepEqual(data.links[0], {
      a: tables.links[0].a,
      b: tables.links[0].b,
      games: tables.links[0].games,
    });
  });

  test(`${name} export file text decodes to the same data`, () => {
    const decoded = decodeBenchText(JSON.stringify(samples[name]));
    assert.ok(Result.isSuccess(decoded));
    assert.deepEqual(decoded.success, benchDataFromTables(tables));
  });
}

test("a { nodes, links } file still decodes; other JSON fails with a tagged error", () => {
  const plain = {
    nodes: [
      { playerId: 1, name: "A", games: 2 },
      { playerId: 2, name: "B", games: 3 },
    ],
    links: [{ a: 1, b: 2, games: 3 }],
  };
  const ok = decodeBenchText(JSON.stringify(plain));
  assert.ok(Result.isSuccess(ok));
  assert.deepEqual(ok.success, plain);
  const bad = decodeBenchText('{"x":1}');
  assert.ok(Result.isFailure(bad));
  assert.equal(bad.failure._tag, "BenchFileError");
});

test("validateBench rejects a dangling link, negative games, and a repeated player", () => {
  const node = (playerId: number, games = 1) => ({
    playerId,
    name: "N",
    games,
  });
  assert.ok(
    Result.isSuccess(
      validateBench({
        nodes: [node(1), node(2)],
        links: [{ a: 1, b: 2, games: 0 }],
      })
    )
  );
  assert.ok(
    Result.isFailure(
      validateBench({ nodes: [node(1)], links: [{ a: 1, b: 2, games: 1 }] })
    )
  );
  assert.ok(
    Result.isFailure(validateBench({ nodes: [node(1, -1)], links: [] }))
  );
  assert.ok(
    Result.isFailure(
      validateBench({
        nodes: [node(1), node(2)],
        links: [{ a: 1, b: 2, games: -2 }],
      })
    )
  );
  assert.ok(
    Result.isFailure(validateBench({ nodes: [node(1), node(1)], links: [] }))
  );
  assert.ok(
    Result.isFailure(
      decodeBenchText(
        JSON.stringify({ nodes: [node(1)], links: [{ a: 1, b: 9, games: 1 }] })
      )
    )
  );
});
