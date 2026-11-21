import assert from "node:assert/strict";
import { test } from "node:test";

import { SimulatedClock, createActor } from "xstate";

import {
  minQueryLength,
  pickerMachine,
  searchDelayMs,
} from "../src/explorer/player-picker-machine.ts";

const options = [
  { playerId: 8478402, name: "Connor McDavid" },
  { playerId: 8480801, name: "Cameron McDavid" },
  { playerId: 8471214, name: "Alex McDavid" },
];

// The picker runs synchronously under a simulated clock, so each test moves time itself.
const start = () => {
  const clock = new SimulatedClock();
  const actor = createActor(pickerMachine, { clock });
  const picked: number[] = [];
  actor.on("Picked", ({ playerId }) => {
    picked.push(playerId);
  });
  actor.start();
  return { actor, clock, picked };
};

// Types the query, lets the delay pass and delivers its results, as the component does once they arrive.
const searched = (text = "mcdav") => {
  const picker = start();
  picker.actor.send({ type: "Type", text });
  picker.clock.increment(searchDelayMs);
  picker.actor.send({ type: "Results", query: text.trim(), options });
  return picker;
};

test("the draft becomes the query only after typing pauses", () => {
  const { actor, clock } = start();
  actor.send({ type: "Type", text: "mc" });
  clock.increment(searchDelayMs - 50);
  actor.send({ type: "Type", text: "mcd" });
  clock.increment(searchDelayMs - 50);
  const waiting = actor.getSnapshot();
  assert.ok(waiting.matches("debouncing"));
  assert.equal(waiting.context.draft, "mcd");
  assert.equal(waiting.context.query, "");
  assert.equal(waiting.context.open, false);
  clock.increment(50);
  const settled = actor.getSnapshot();
  assert.ok(settled.matches("settled"));
  assert.equal(settled.context.query, "mcd");
  assert.equal(settled.context.open, true);
});

test("a query shorter than the minimum does not open the list", () => {
  const { actor, clock } = start();
  actor.send({ type: "Type", text: " m " });
  clock.increment(searchDelayMs);
  const short = actor.getSnapshot();
  assert.equal(minQueryLength, 2);
  assert.equal(short.context.query, "");
  assert.equal(short.context.open, false);
  actor.send({ type: "HighlightNext" });
  assert.equal(actor.getSnapshot().context.open, false);
  actor.send({ type: "Type", text: " mc " });
  clock.increment(searchDelayMs);
  assert.equal(actor.getSnapshot().context.query, "mc");
  assert.equal(actor.getSnapshot().context.open, true);
});

test("results for an older query are ignored", () => {
  const { actor } = searched("mcdav");
  actor.send({ type: "Results", query: "mcd", options: [] });
  assert.equal(actor.getSnapshot().context.options.length, options.length);
});

test("ArrowDown and ArrowUp move the highlight and wrap", () => {
  const { actor } = searched();
  const highlighted = () => actor.getSnapshot().context.highlighted;
  assert.equal(highlighted(), null);
  actor.send({ type: "HighlightNext" });
  assert.equal(highlighted(), 0);
  actor.send({ type: "HighlightNext" });
  actor.send({ type: "HighlightNext" });
  assert.equal(highlighted(), 2);
  actor.send({ type: "HighlightNext" });
  assert.equal(highlighted(), 0);
  actor.send({ type: "HighlightPrevious" });
  assert.equal(highlighted(), 2);
  actor.send({ type: "Highlight", index: 1 });
  assert.equal(highlighted(), 1);
  // Fewer results drop a highlight past their end.
  actor.send({ type: "Results", query: "mcdav", options: options.slice(0, 1) });
  assert.equal(highlighted(), null);
});

test("ArrowUp from no highlight lands on the last option", () => {
  const { actor } = searched();
  actor.send({ type: "HighlightPrevious" });
  assert.equal(actor.getSnapshot().context.highlighted, options.length - 1);
});

test("Enter picks the highlighted option and shows its name", () => {
  const { actor, picked } = searched();
  actor.send({ type: "PickHighlighted" });
  assert.deepEqual(picked, []);
  actor.send({ type: "HighlightNext" });
  actor.send({ type: "PickHighlighted" });
  assert.deepEqual(picked, [8478402]);
  const after = actor.getSnapshot();
  assert.equal(after.context.draft, "Connor McDavid");
  assert.equal(after.context.query, "");
  assert.equal(after.context.open, false);
  assert.equal(after.context.highlighted, null);
});

test("a click picks the option it lands on", () => {
  const { actor, picked } = searched();
  actor.send({ type: "PickOption", index: 2 });
  assert.deepEqual(picked, [8471214]);
  actor.send({ type: "PickOption", index: 0 });
  // The list closed with the first pick.
  assert.deepEqual(picked, [8471214]);
});

test("the first Escape closes the list and the second clears the draft", () => {
  const { actor, picked } = searched();
  actor.send({ type: "HighlightNext" });
  actor.send({ type: "Escape" });
  const closed = actor.getSnapshot();
  assert.equal(closed.context.open, false);
  assert.equal(closed.context.draft, "mcdav");
  // Enter on a closed list picks nothing.
  actor.send({ type: "PickHighlighted" });
  assert.deepEqual(picked, []);
  actor.send({ type: "Escape" });
  const cleared = actor.getSnapshot();
  assert.equal(cleared.context.draft, "");
  assert.equal(cleared.context.query, "");
  assert.equal(cleared.context.options.length, 0);
});

test("ArrowDown reopens a list that Escape or blur closed", () => {
  const { actor } = searched();
  actor.send({ type: "Blur" });
  assert.equal(actor.getSnapshot().context.open, false);
  actor.send({ type: "HighlightNext" });
  assert.equal(actor.getSnapshot().context.open, true);
  assert.equal(actor.getSnapshot().context.options.length, options.length);
});

test("Escape or blur while typing keeps a pending search from reopening the list", () => {
  const { actor, clock } = searched();
  actor.send({ type: "Type", text: "mcdavi" });
  actor.send({ type: "Blur" });
  clock.increment(searchDelayMs);
  const blurred = actor.getSnapshot();
  assert.ok(blurred.matches("settled"));
  assert.equal(blurred.context.open, false);
  assert.equal(blurred.context.query, "mcdavi");
});

test("reset drops the draft and the queued search", () => {
  const { actor, clock } = searched();
  actor.send({ type: "Type", text: "drais" });
  actor.send({ type: "Reset" });
  clock.increment(searchDelayMs);
  const reset = actor.getSnapshot();
  assert.ok(reset.matches("settled"));
  assert.deepEqual(reset.context, {
    draft: "",
    query: "",
    open: false,
    highlighted: null,
    options: [],
  });
});
