import assert from "node:assert/strict";
import { test } from "node:test";

import {
  idleInspection,
  inspectGame,
  inspectedGame,
} from "../src/game-inspection.ts";
import type { GameInspectionEvent } from "../src/game-inspection.ts";

const point = (game: number | null, team = "NJD"): GameInspectionEvent => ({
  type: "point",
  team,
  game,
});
const hold = (game: number | null, team = "NJD"): GameInspectionEvent => ({
  type: "hold",
  team,
  game,
});
const after = (events: GameInspectionEvent[], team = "NJD") =>
  inspectedGame(events.reduce(inspectGame, idleInspection("NJD")), team);

test("hovering highlights a game only while the pointer stays", () => {
  assert.equal(after([]), null);
  assert.equal(after([point(4)]), 4);
  assert.equal(after([point(4), point(5)]), 5);
  assert.equal(after([point(4), point(null)]), null);
});

test("a held game survives the pointer passing over another chart or row", () => {
  assert.equal(after([hold(10), point(20)]), 20);
  assert.equal(after([hold(10), point(20), point(null)]), 10);
});

test("a keyboard move wins over a resting pointer until the pointer moves again", () => {
  assert.equal(after([point(20), hold(11)]), 11);
  assert.equal(after([point(20), hold(11), point(21)]), 21);
});

test("blur or Escape clears the highlight", () => {
  assert.equal(after([hold(10), hold(null)]), null);
  assert.equal(after([hold(10), point(20), hold(null)]), null);
});

test("a highlight never carries over to another team", () => {
  assert.equal(after([hold(10)], "BOS"), null);
  assert.equal(after([hold(10), point(3, "BOS")], "BOS"), 3);
  assert.equal(
    after([hold(10), point(3, "BOS"), point(null, "BOS")], "BOS"),
    null
  );
  // A late blur from the previous team's poster cannot disturb the current one.
  assert.equal(after([point(3, "BOS"), hold(null, "NJD")], "BOS"), null);
});

test("a repeated request returns the same state so React can skip the render", () => {
  const state = inspectGame(idleInspection("NJD"), point(4));
  assert.equal(inspectGame(state, point(4)), state);
  const held = inspectGame(state, hold(4));
  assert.equal(inspectGame(held, hold(4)), held);
});
