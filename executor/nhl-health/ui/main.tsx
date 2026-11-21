import {
  createAppClient,
  mutationReference,
  queryReference,
} from "apps/client";
import { useAppQuery } from "apps/react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import type { checkNow, history } from "../index.js";
import { Checks, Sources, type CheckRow } from "../schema.js";

import "./style.css";

const client = createAppClient();
const observations = client.queryAtom(
  queryReference<typeof history>("history"),
  {},
  Checks
);
const check = client.mutation(
  mutationReference<typeof checkNow>("checkNow"),
  Checks
);
const labels: Record<string, string> = {
  recent: "Recent snapshot",
  stale: "Stale snapshot",
  unknown: "Freshness unknown",
  failed: "Check failed",
};
const timestamp = (time: number) => new Date(time).toLocaleString();

function Status({ row }: { row?: CheckRow }) {
  return (
    <span className={`status ${row?.status ?? "unchecked"}`}>
      {row ? (labels[row.status] ?? row.status) : "Not checked"}
    </span>
  );
}

function Dashboard() {
  const { data, pending, error } = useAppQuery(observations);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const rows = data ?? [];
  const latest = rows[0];
  async function performCheck() {
    if (checking) return;
    setChecking(true);
    setMessage("Checking public NHL sources…");
    try {
      const saved = await check({});
      setMessage(
        `Saved ${saved.length} observations. ${saved.filter((row) => row.status === "failed").length} source checks failed.`
      );
    } catch {
      setMessage(
        "Could not confirm the check was saved. Review history before trying again."
      );
    } finally {
      setChecking(false);
    }
  }
  return (
    <main>
      <header>
        <span className="brand">
          <span className="puck" aria-hidden="true">
            ✳
          </span>{" "}
          NHL / DATA HEALTH
        </span>
        <span className="mode">Manual checks</span>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">SOURCE MONITOR</p>
          <h1>
            Know what’s
            <br />
            up to date.
          </h1>
          <p className="subtitle">
            Two public NHL feeds. One clear record of what we observed.
          </p>
        </div>
        <div className="action">
          <button
            disabled={checking}
            onClick={() => {
              void performCheck();
            }}
          >
            {checking ? "Checking…" : "Check now ↗"}
          </button>
          <p>
            {latest
              ? `Last check: ${timestamp(latest.checkedAt)}`
              : "No checks saved yet"}
          </p>
        </div>
      </section>
      <p className="notice">
        Results describe the source at check time. They do not update
        automatically or prove live game statistics are current.
      </p>
      <p role="status" aria-live="polite" className="feedback">
        {message}
      </p>
      {error && (
        <p role="alert" className="error">
          History could not refresh: {error}. Any visible results are from the
          last successful read.
        </p>
      )}
      <section className="sources" aria-label="Source health">
        {Sources.map((source) => {
          const row = rows.find((item) => item.source === source.id);
          return (
            <article key={source.id}>
              <div className="card-heading">
                <h2>{source.name}</h2>
                <Status row={row} />
              </div>
              <p className="source-date">{row?.sourceDate || "—"}</p>
              <p className="caption">
                {source.id === "standings"
                  ? "Standings snapshot date"
                  : "Game date returned by source"}
              </p>
              <p className="explanation">
                {row?.detail ??
                  (pending
                    ? "Loading saved observations…"
                    : "Run a check to read this source and save its result.")}
              </p>
              <div className="card-footer">
                <span>
                  {row
                    ? `${row.records} records · ${row.httpStatus ? `HTTP ${row.httpStatus}` : "No HTTP response"}`
                    : "Awaiting first check"}
                </span>
                <a href={source.url} target="_blank" rel="noreferrer">
                  View source ↗
                </a>
              </div>
            </article>
          );
        })}
      </section>
      <section className="history" aria-labelledby="history-title">
        <div className="section-heading">
          <h2 id="history-title">Check history</h2>
          <span>Latest 100 source observations</span>
        </div>
        {pending ? (
          <p className="empty">Loading history…</p>
        ) : rows.length === 0 ? (
          <p className="empty">Your first check starts the record.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Saved NHL source checks, newest first. Times use your browser’s
                timezone.
              </caption>
              <thead>
                <tr>
                  <th>Checked at</th>
                  <th>Source</th>
                  <th>Result</th>
                  <th>Source date</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{timestamp(row.checkedAt)}</td>
                    <td>
                      {Sources.find((source) => source.id === row.source)
                        ?.name ?? row.source}
                    </td>
                    <td>
                      <Status row={row} />
                      <details>
                        <summary>Details</summary>
                        <p>
                          {row.detail} HTTP: {row.httpStatus || "No response"}.
                        </p>
                      </details>
                    </td>
                    <td>{row.sourceDate || "Unknown"}</td>
                    <td>{row.records}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <footer>
        <span>Standings policy: today or yesterday in Eastern time.</span>
        <span>History stored in this Executor app.</span>
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (root === null) {
  // defect: the app HTML must provide its React mount element.
  throw new Error("Missing app root");
}
createRoot(root).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>
);
