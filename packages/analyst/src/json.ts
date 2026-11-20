import { Array, Option, Result, Schema } from "effect";

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
  Schema.decodeSync(Compact)(toJson(value));

export type Checked<T> =
  | { readonly ok: true; readonly input: T }
  | { readonly ok: false; readonly reason: string };

// Decodes model-supplied tool arguments. A failure reports the first line of the schema
// message, so the schema's own `message` annotations become the text the model reads back.
export const checkWith =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (raw: unknown): Checked<S["Type"]> => {
    const decoded = Schema.decodeUnknownResult(schema)(raw);
    return Result.isSuccess(decoded)
      ? { ok: true, input: decoded.success }
      : {
          ok: false,
          reason: Option.getOrElse(
            Array.head(decoded.failure.message.split("\n")),
            () => decoded.failure.message
          ),
        };
  };
