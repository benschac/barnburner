import assert from "node:assert/strict"
import test from "node:test"
import { vizPackage } from "../src/contracts.ts"

test("viz package scaffold exports its name", () => {
  assert.equal(vizPackage, "@nhl-reddit-stats/viz")
})
