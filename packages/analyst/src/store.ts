import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Result, Schema } from "effect";

import { InsightCard as InsightCardSchema } from "./card.ts";
import type { InsightCard } from "./card.ts";
import { parseJson, toPrettyJson } from "./json.ts";

const CardList = Schema.Array(InsightCardSchema);

export const cardsPath = (dir: string, team: string): string =>
  join(dir, `${team}.json`);

// An expected refusal to read or write a team file: invalid JSON, cards that do not decode,
// or a card filed under another team.
export class StoreError extends Schema.TaggedError<
  StoreError,
  { readonly brand: unique symbol }
>()("StoreError", {
  file: Schema.String,
  team: Schema.String,
  reason: Schema.String,
}) {
  override get message(): string {
    return `${this.file}: ${this.reason}`;
  }
}

const invalidCards =
  (file: string, team: string) =>
  (error: Schema.SchemaError): StoreError =>
    new StoreError({ file, team, reason: `invalid cards: ${String(error)}` });

// A missing file reads as []. An invalid file, or a card filed under another team, fails with StoreError.
export const readCards = (
  dir: string,
  team: string
): Result.Result<readonly InsightCard[], StoreError> => {
  const file = cardsPath(dir, team);
  if (!existsSync(file)) return Result.succeed([]);
  const text = readFileSync(file, "utf-8");
  const json = Result.mapError(
    parseJson(text),
    (error) => new StoreError({ file, team, reason: error.message })
  );
  if (Result.isFailure(json)) return Result.fail(json.failure);
  const cards = Result.mapError(
    Schema.decodeUnknownResult(CardList)(json.success),
    invalidCards(file, team)
  );
  if (Result.isFailure(cards)) return cards;
  const stray = cards.success.find((card) => card.team !== team);
  if (stray !== undefined)
    return Result.fail(
      new StoreError({
        file,
        team,
        reason: `card ${stray.id} has team ${stray.team}, expected ${team}`,
      })
    );
  return cards;
};

export const writeCards = (
  dir: string,
  team: string,
  cards: readonly InsightCard[]
): Result.Result<void, StoreError> => {
  const file = cardsPath(dir, team);
  // Validate everything before touching the file, so a bad write leaves existing contents unchanged.
  const valid = Result.mapError(
    Schema.decodeResult(CardList)(cards),
    invalidCards(file, team)
  );
  if (Result.isFailure(valid)) return Result.fail(valid.failure);
  const stray = valid.success.find((card) => card.team !== team);
  if (stray !== undefined)
    return Result.fail(
      new StoreError({
        file,
        team,
        reason: `cannot write card ${stray.id} with team ${stray.team} to ${team}`,
      })
    );
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${toPrettyJson(valid.success)}\n`);
  return Result.succeed(undefined);
};

// Keeps every existing card in order. Adds incoming cards with new ids. Replaces an existing card
// only when it is pending. Approved, rejected and stale cards are never changed.
// Cards are keyed by id, so two existing cards with the same id collapse to the later one.
export const mergePending = (
  existing: readonly InsightCard[],
  incoming: readonly InsightCard[]
): InsightCard[] => {
  // A Map keeps insertion order, and overwriting a key keeps its position.
  const byId = new Map(existing.map((card) => [card.id, card]));
  for (const card of incoming) {
    const current = byId.get(card.id);
    if (current === undefined || current.status === "pending")
      byId.set(card.id, card);
  }
  return [...byId.values()];
};
