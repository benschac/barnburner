import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import type { Sql, SqlRow, SqlValue } from "apps";

import {
  assessScores,
  assessStandings,
  checkSource,
  recentChecks,
  runCheck,
  saveChecks,
} from "./health.js";
import { Sources, type CheckRow } from "./schema.js";

const now = Date.parse("2026-11-20T15:00:00Z");
const team = {
  date: "2026-11-19",
  teamAbbrev: { default: "BOS" },
  gamesPlayed: 20,
  points: 25,
};
const standings = Sources[0];
const signal = new AbortController().signal;
const network = (response: Response) => ({
  signal,
  fetch: async () => response,
});
const row: CheckRow = {
  id: "a",
  source: "standings",
  checkedAt: now,
  status: "recent",
  sourceDate: "2026-11-19",
  records: 32,
  httpStatus: 200,
  detail: "Snapshot is recent.",
};

async function storage() {
  const db = new Database(":memory:");
  db.exec(
    await Bun.file(
      new URL("./migrations/0001_checks.sql", import.meta.url)
    ).text()
  );
  const sql: Sql = {
    exec<Row extends SqlRow>(query: string, ...bindings: SqlValue[]) {
      const result = db.query<Row, SqlValue[]>(query).all(...bindings);
      return {
        columnNames: Object.keys(result[0] ?? {}),
        rowsRead: result.length,
        rowsWritten: db.query("SELECT changes() AS n").get()?.n as number,
        toArray: () => result,
        one: () => {
          if (result.length !== 1 || !result[0])
            throw new Error("Expected one row");
          return result[0];
        },
        [Symbol.iterator]: () => result[Symbol.iterator](),
      };
    },
    transaction: (work) => db.transaction(() => work(sql))(),
  };
  return { db, sql };
}

describe("honest freshness", () => {
  test("today and yesterday are recent; older is stale", () => {
    expect(assessStandings({ standings: [team] }, now).status).toBe("recent");
    expect(
      assessStandings({ standings: [{ ...team, date: "2026-11-20" }] }, now)
        .status
    ).toBe("recent");
    expect(
      assessStandings({ standings: [{ ...team, date: "2026-11-18" }] }, now)
        .status
    ).toBe("stale");
  });
  test("uses Eastern calendar day across UTC midnight", () => {
    expect(
      assessStandings(
        { standings: [{ ...team, date: "2026-11-18" }] },
        Date.parse("2026-11-20T02:00:00Z")
      ).status
    ).toBe("recent");
  });
  test.each([undefined, "", "garbage", "2026-02-30", "2026-11-21"])(
    "missing, invalid and future date %s is unknown",
    (date) => {
      expect(
        assessStandings({ standings: [{ ...team, date }] }, now).status
      ).toBe("unknown");
    }
  );
  test("mixed dates do not borrow the newest date", () => {
    expect(
      assessStandings(
        {
          standings: [
            team,
            { ...team, teamAbbrev: { default: "TOR" }, date: "2026-11-18" },
          ],
        },
        now
      ).status
    ).toBe("unknown");
  });
  test("empty and duplicate standings fail", () => {
    expect(assessStandings({ standings: [] }, now).status).toBe("failed");
    expect(assessStandings({ standings: [team, team] }, now).status).toBe(
      "failed"
    );
  });
  test("zero scores are valid but game date cannot establish freshness", () => {
    expect(
      assessScores({ currentDate: "2026-11-20", games: [] })
    ).toMatchObject({ status: "unknown", records: 0 });
  });
});

describe("source boundary", () => {
  test("decodes source and never uses response-generation timestamp for freshness", async () => {
    const response = Response.json({
      standingsDateTimeUtc: "2026-11-20T15:00:00Z",
      standings: [{ ...team, date: "2026-11-01" }],
    });
    expect(await checkSource(network(response), standings, now)).toMatchObject({
      status: "stale",
      httpStatus: 200,
    });
  });
  test("non-JSON and malformed data fail without leaking response content", async () => {
    for (const response of [
      new Response("private diagnostic"),
      Response.json({ standings: [{}] }),
    ]) {
      const result = await checkSource(network(response), standings, now);
      expect(result.status).toBe("failed");
      expect(result.detail).not.toContain("private diagnostic");
    }
  });
  test("HTTP failure preserves status", async () => {
    expect(
      await checkSource(
        network(new Response("", { status: 503 })),
        standings,
        now
      )
    ).toMatchObject({ status: "failed", httpStatus: 503 });
  });
  test("network failure is recorded", async () => {
    expect(
      await checkSource(
        {
          signal,
          fetch: async () => {
            throw new Error("offline");
          },
        },
        standings,
        now
      )
    ).toMatchObject({ status: "failed", httpStatus: 0 });
  });
  test("cancellation is propagated", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      checkSource(
        {
          ...network(Response.json({ standings: [team] })),
          signal: controller.signal,
        },
        standings,
        now
      )
    ).rejects.toBeDefined();
  });
});

describe("app-owned history", () => {
  test("saves failed and successful observations, survives new read, uses fixed GET URLs", async () => {
    const { db, sql } = await storage();
    const urls: string[] = [];
    const results = await runCheck({
      sql,
      signal,
      fetch: async (url, init) => {
        urls.push(String(url));
        expect(init?.method).toBeUndefined();
        return String(url).includes("standings")
          ? Response.json({ standings: [team] })
          : new Response("", { status: 503 });
      },
    });
    expect(urls).toEqual(Sources.map((source) => source.url));
    expect(results).toHaveLength(2);
    expect(recentChecks(sql)).toHaveLength(2);
    expect(recentChecks(sql).some((saved) => saved.status === "failed")).toBe(
      true
    );
    db.close();
  });
  test("transaction rolls back if the second insert fails", async () => {
    const { db, sql } = await storage();
    expect(() => saveChecks(sql, [row, row])).toThrow();
    expect(recentChecks(sql)).toEqual([]);
    db.close();
  });
  test("history is bounded, ordered and indexed", async () => {
    const { db, sql } = await storage();
    saveChecks(
      sql,
      Array.from({ length: 110 }, (_, index) => ({
        ...row,
        id: `row-${index}`,
        checkedAt: now + index,
      }))
    );
    const rows = recentChecks(sql);
    expect(rows).toHaveLength(100);
    expect(rows[0]?.checkedAt).toBe(now + 109);
    expect(rows[99]?.checkedAt).toBe(now + 10);
    expect(
      db
        .query(
          "EXPLAIN QUERY PLAN SELECT * FROM checks ORDER BY checkedAt DESC, id DESC LIMIT 100"
        )
        .all()
        .some((plan) => String(plan.detail).includes("checks_recent"))
    ).toBe(true);
    db.close();
  });
  test("cancelled run writes no history", async () => {
    const { db, sql } = await storage();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runCheck({
        sql,
        signal: controller.signal,
        fetch: async () => Response.json({ standings: [team] }),
      })
    ).rejects.toBeDefined();
    expect(recentChecks(sql)).toEqual([]);
    db.close();
  });
});
