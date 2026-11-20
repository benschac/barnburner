import { Result, Schema } from "effect";

export type Binding = { column: string; row: number };

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const DIGIT = /[0-9]/g;

export class UnknownPlaceholderError extends Schema.TaggedError<
  UnknownPlaceholderError,
  { readonly brand: unique symbol }
>()("UnknownPlaceholderError", {
  placeholder: Schema.String,
}) {
  override get message(): string {
    return `Template placeholder {${this.placeholder}} has no binding`;
  }
}

export class MissingCellError extends Schema.TaggedError<
  MissingCellError,
  { readonly brand: unique symbol }
>()("MissingCellError", {
  placeholder: Schema.String,
  column: Schema.String,
  row: Schema.Number,
}) {
  override get message(): string {
    return `Template placeholder {${this.placeholder}} needs a value at row ${this.row}, column "${this.column}", but that cell is missing or null`;
  }
}

export type RenderError = UnknownPlaceholderError | MissingCellError;

const cellText = (
  placeholder: string,
  bindings: Record<string, Binding>,
  rows: Row[]
): Result.Result<string, RenderError> => {
  const binding = Object.hasOwn(bindings, placeholder)
    ? bindings[placeholder]
    : undefined;
  if (binding === undefined)
    return Result.fail(new UnknownPlaceholderError({ placeholder }));
  const row = Number.isInteger(binding.row) ? rows[binding.row] : undefined;
  const value =
    row && Object.hasOwn(row, binding.column) ? row[binding.column] : undefined;
  if (value === undefined || value === null) {
    return Result.fail(
      new MissingCellError({
        placeholder,
        column: binding.column,
        row: binding.row,
      })
    );
  }
  return Result.succeed(String(value));
};

/**
 * Replaces each `{name}` in the template with the cell named by its binding.
 * Braces that do not form a valid placeholder are kept as literal text.
 * Fails with the first UnknownPlaceholderError or MissingCellError instead of rendering an empty value.
 */
export function render(
  template: string,
  bindings: Record<string, Binding>,
  rows: Row[]
): Result.Result<string, RenderError> {
  const parts: string[] = [];
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    const cell = cellText(match[1] ?? "", bindings, rows);
    if (Result.isFailure(cell)) return cell;
    parts.push(template.slice(last, match.index), cell.success);
    last = match.index + match[0].length;
  }
  parts.push(template.slice(last));
  return Result.succeed(parts.join(""));
}

/** Returns every digit that appears outside a `{placeholder}`, in order. */
export function literalDigits(template: string): string[] {
  return [...template.replace(PLACEHOLDER, "").matchAll(DIGIT)].map(
    (match) => match[0]
  );
}
