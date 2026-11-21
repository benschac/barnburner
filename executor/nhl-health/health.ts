import {
  decodeJson,
  type Infer,
  type MutationContext,
  type Sql,
  type SqlReader,
} from "apps";

import {
  Check,
  Checks,
  Scores,
  Sources,
  Standings,
  type CheckRow,
  type Source,
} from "./schema.js";

const dayMs = 86_400_000;

function calendarDay(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    return undefined;
  return time / dayMs;
}

function easternDate(time: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time);
}

type Assessment = Pick<
  CheckRow,
  "status" | "sourceDate" | "records" | "detail"
>;

export function assessStandings(
  data: Infer<typeof Standings>,
  checkedAt: number
): Assessment {
  const records = data.standings.length;
  const dates = data.standings.map((row) => row.date);
  const sourceDate = dates[0] ?? "";
  if (records === 0)
    return {
      status: "failed",
      sourceDate: "",
      records,
      detail: "Standings returned no teams.",
    };
  if (
    data.standings.some(
      (row, index, rows) =>
        row.gamesPlayed < 0 ||
        row.points < 0 ||
        !Number.isInteger(row.gamesPlayed) ||
        !Number.isInteger(row.points) ||
        !/^[A-Z]{3}$/.test(row.teamAbbrev.default) ||
        rows.findIndex(
          (other) => other.teamAbbrev.default === row.teamAbbrev.default
        ) !== index
    )
  ) {
    return {
      status: "failed",
      sourceDate,
      records,
      detail: "Standings contain invalid or duplicate team records.",
    };
  }
  const sourceDay = calendarDay(sourceDate);
  const today = calendarDay(easternDate(checkedAt));
  if (
    sourceDay === undefined ||
    today === undefined ||
    dates.some((date) => date !== sourceDate) ||
    sourceDay > today
  ) {
    return {
      status: "unknown",
      sourceDate,
      records,
      detail:
        "Snapshot dates are missing, invalid, mixed, or in the future. Freshness cannot be confirmed.",
    };
  }
  const stale = today - sourceDay > 1;
  return {
    status: stale ? "stale" : "recent",
    sourceDate,
    records,
    detail: stale
      ? "Snapshot is older than yesterday in Eastern time. This can also happen in the offseason."
      : "Snapshot date is today or yesterday in Eastern time. This does not verify every statistic or live update.",
  };
}

export function assessScores(data: Infer<typeof Scores>): Assessment {
  return {
    status: "unknown",
    sourceDate: data.currentDate ?? "",
    records: data.games.length,
    detail:
      "Response shape is valid. The game date is not an update timestamp, so freshness is unknown. Zero games can be normal.",
  };
}

type Network = Pick<MutationContext<{}>, "fetch" | "signal">;

export async function checkSource(
  ctx: Network,
  source: Source,
  checkedAt: number
): Promise<CheckRow> {
  const base = {
    id: crypto.randomUUID(),
    source: source.id,
    checkedAt,
    sourceDate: "",
    records: 0,
    httpStatus: 0,
  };
  let response: Response;
  try {
    response = await ctx.fetch(source.url, {
      signal: ctx.signal,
      cache: "no-store",
    });
  } catch {
    ctx.signal.throwIfAborted();
    return Check.parse({
      ...base,
      status: "failed",
      detail: "The source could not be reached.",
    });
  }
  ctx.signal.throwIfAborted();
  const observed = { ...base, httpStatus: response.status };
  if (!response.ok) {
    await response.body?.cancel();
    return Check.parse({
      ...observed,
      status: "failed",
      detail: `Source returned HTTP ${response.status}.`,
    });
  }
  let assessment: Assessment;
  try {
    assessment =
      source.id === "standings"
        ? assessStandings(await decodeJson(response, Standings), checkedAt)
        : assessScores(await decodeJson(response, Scores));
  } catch {
    ctx.signal.throwIfAborted();
    return Check.parse({
      ...observed,
      status: "failed",
      detail:
        "Source body was unreadable or did not match the expected NHL response.",
    });
  }
  return Check.parse({ ...observed, ...assessment });
}

export function saveChecks(sql: Sql, rows: readonly CheckRow[]): void {
  const validated = Checks.parse(rows);
  sql.transaction(() => {
    for (const row of validated) {
      sql.exec(
        "INSERT INTO checks (id, source, checkedAt, status, sourceDate, records, httpStatus, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.source,
        row.checkedAt,
        row.status,
        row.sourceDate,
        row.records,
        row.httpStatus,
        row.detail
      );
    }
  });
}

export function recentChecks(sql: SqlReader): readonly CheckRow[] {
  return Checks.parse(
    sql
      .exec<CheckRow>(
        "SELECT * FROM checks ORDER BY checkedAt DESC, id DESC LIMIT 100"
      )
      .toArray()
  );
}

export async function runCheck(
  ctx: Network & { sql: Sql }
): Promise<CheckRow[]> {
  const checkedAt = Date.now();
  const rows = await Promise.all(
    Sources.map((source) => checkSource(ctx, source, checkedAt))
  );
  ctx.signal.throwIfAborted();
  saveChecks(ctx.sql, rows);
  return rows;
}
