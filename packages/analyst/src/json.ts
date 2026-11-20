import { Result, Schema } from "effect";

// The one JSON boundary for this package. Parsing returns `unknown`, so a caller has to decode
// the value with a schema before using it.

const Compact = Schema.fromJsonString(Schema.Unknown);
const Pretty = Schema.fromJsonString(Schema.Unknown, { space: 2 });

export class JsonParseError extends Schema.TaggedError<
  JsonParseError,
  { readonly brand: unique symbol }
>()("JsonParseError", {
  reason: Schema.String,
}) {
  override get message(): string {
    return `invalid JSON: ${this.reason}`;
  }
}

const decodeCompact = Schema.decodeUnknownResult(Compact);

export const parseJson = (
  text: string
): Result.Result<unknown, JsonParseError> =>
  Result.mapError(
    decodeCompact(text),
    (error) => new JsonParseError({ reason: error.message })
  );

// Both fail as defects on a value JSON cannot represent: undefined, a bigint, or a cycle.
export const toJson: (value: unknown) => string = Schema.encodeSync(Compact);
export const toPrettyJson: (value: unknown) => string =
  Schema.encodeSync(Pretty);

// The value as it reads back from JSON: undefined fields dropped, dates as strings.
export const jsonRoundTrip = (value: unknown): unknown =>
  Result.getOrThrow(decodeCompact(toJson(value)));
