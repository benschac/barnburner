import { createHash } from "node:crypto";

import { Array as Arr, Result, Schema } from "effect";

const tableRows = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .split(/(?<!\\)\|/)
        .slice(1, -1)
        .map((cell) => cell.trim().replaceAll("\\|", "|"))
    )
    .filter((row) => !row.every((cell) => /^[- :]+$/.test(cell)));

const expandIds = (id: string) => {
  const range = /^([A-Z]+)(\d+)–\1(\d+)$/.exec(id);
  return range
    ? Array.from(
        { length: Number(range[3]) - Number(range[2]) + 1 },
        (_, index) => range[1] + (Number(range[2]) + index)
      )
    : [id];
};

const prerequisiteTitles = new Map([
  ["P-plan", "Commit the plan & initialise Graphite"],
  ["P-deps", "Approve dependencies"],
  ["P-key", "Provide an AI Gateway key"],
  ["P-pr", "Enable CI pull requests"],
  ["P-rights", "Confirm data rights"],
]);

// The plan document does not have the structure the viewer needs. `subject` names the section,
// card, or task at fault.
export class PlanParseError extends Schema.TaggedError<
  PlanParseError,
  { readonly brand: unique symbol }
>()("PlanParseError", {
  reason: Schema.String,
  subject: Schema.String,
}) {
  override get message(): string {
    return `${this.reason}: ${this.subject}`;
  }
}

type PlanCard = {
  readonly heading: string;
  readonly body: string;
  readonly ids: string[];
  readonly group: string;
};

type PlanTask = {
  readonly id: string;
  readonly group: string;
  readonly category: string;
  readonly model: string;
  readonly needs: string[];
  readonly branch: string;
  readonly pr: string;
  readonly status: string;
  readonly notes: string;
  readonly title: string;
  readonly heading: string;
  readonly body: string;
  readonly parent: string | null;
};

const refuse = (reason: string, subject: string) =>
  Result.fail(new PlanParseError({ reason, subject }));

export const parseAnalystPlan = (source: string) =>
  Result.gen(function* () {
    const sourceHash = createHash("sha256").update(source).digest("hex");
    const section = (name: string): Result.Result<string, PlanParseError> => {
      const part = source.split(`\n## ${name}\n`)[1];
      return part === undefined
        ? refuse("Missing source section", name)
        : Result.succeed(part.split("\n## ")[0].trim());
    };
    const cardText = yield* section("Task cards");
    const groups = [...cardText.matchAll(/^### (.+)$/gm)].map(
      (match) => match[1]
    );
    const cards = yield* Result.all(
      [
        ...cardText.matchAll(
          /^#### (.+)\n([\s\S]*?)(?=^### |^#### |$(?![\s\S]))/gm
        ),
      ].map((match): Result.Result<PlanCard, PlanParseError> => {
        const group = [
          ...cardText.slice(0, match.index).matchAll(/^### (.+)$/gm),
        ].at(-1)?.[1];
        return group
          ? Result.succeed({
              heading: match[1],
              body: match[2].trim(),
              ids: expandIds(match[1].split(" · ")[0]),
              group,
            })
          : refuse("Task card has no workstream", match[1]);
      })
    );
    // A prerequisite's card is its bullet in the card text; every other task has a card of its own.
    const taskCard = (id: string): Result.Result<PlanCard, PlanParseError> => {
      const card = id.startsWith("P-")
        ? {
            heading: "Prerequisites (you)",
            group: groups[0],
            body: cardText
              .split("\n")
              .find((line) => line.startsWith(`- **${id}:**`)),
            ids: [id],
          }
        : cards.find((item) => item.ids.includes(id));
      return card?.body && card.group
        ? Result.succeed({
            heading: card.heading,
            body: card.body,
            ids: card.ids,
            group: card.group,
          })
        : refuse("No task card for", id);
    };
    const taskTitle = (
      card: PlanCard,
      id: string,
      evalRow: string[] | undefined
    ): Result.Result<string, PlanParseError> => {
      const baseTitle = id.startsWith("P-")
        ? prerequisiteTitles.get(id)
        : card.heading.split(" · ")[1]?.split(" (")[0];
      if (!baseTitle) return refuse("No task title for", id);
      return Result.succeed(
        baseTitle +
          (evalRow
            ? ` / ${evalRow[2]
                .split("/")
                .at(-1)
                ?.replaceAll("`", "")
                .replace(".json", "")}`
            : "") +
          (card.ids.length > 1 && id.startsWith("X")
            ? ` / ${new RegExp(`\\*\\*${id}, ([^:*]+)`).exec(card.body)?.[1]}`
            : "")
      );
    };
    const buildTask = (
      [, model, needs, branch, pr, status, notes]: string[],
      id: string
    ) =>
      Result.gen(function* () {
        if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(id))
          return yield* refuse("Invalid task ID", id);
        const card = yield* taskCard(id);
        const evalRow =
          card.ids.length > 1 && id.startsWith("E")
            ? tableRows(card.body).find((row) => row[0] === id)
            : undefined;
        const title = yield* taskTitle(card, id, evalRow);
        const task: PlanTask = {
          id,
          group: card.ids.length > 1 ? card.heading.split(" · ")[0] : id,
          category: card.group,
          model: evalRow?.[1] ?? model,
          needs:
            needs === "–"
              ? []
              : needs.split(",").flatMap((need) => expandIds(need.trim())),
          branch,
          pr,
          status,
          notes,
          title,
          heading: card.heading,
          body: card.body,
          parent:
            /\*\*Stack on:\*\* ([A-Z]+\d+[a-z]?)/.exec(card.body)?.[1] ?? null,
        };
        return task;
      });
    // Only the first table is the task ledger. Later subsections have their own tables.

    const ledger = (yield* section("Ledger")).split("\n### ")[0];

    const tasks = yield* Result.all(
      tableRows(ledger)
        .slice(1)
        .flatMap((row) => expandIds(row[0]).map((id) => buildTask(row, id)))
    );
    const taskIds = tasks.map((task) => task.id);
    const duplicate = taskIds.find(
      (id, index) => taskIds.indexOf(id) !== index
    );
    if (duplicate !== undefined)
      return yield* refuse("Duplicate ledger task ID", duplicate);
    yield* Result.all(
      cards
        .flatMap((card) => card.ids)
        .map((id) =>
          taskIds.includes(id)
            ? Result.void
            : refuse("Task card missing from ledger", id)
        )
    );
    yield* Result.all(
      tasks.map((task) =>
        task.status
          ? Result.all(
              [...task.needs, ...Arr.fromNullishOr(task.parent)].map(
                (dependency) =>
                  taskIds.includes(dependency)
                    ? Result.void
                    : refuse(`Unknown dependency for ${task.id}`, dependency)
              )
            )
          : refuse("Missing ledger status", task.id)
      )
    );
    const contracts = (yield* section("Contracts"))
      .split("\n### ")
      .slice(1)
      .map((part) => {
        const [title, ...body] = part.split("\n");
        return { title, body: body.join("\n").trim() };
      });
    const nodeId = (id: string) => `n${id.replaceAll("-", "")}`;
    const dependencyDiagrams: Record<string, string> = Object.fromEntries(
      tasks.map((task) => {
        const dependents = tasks.filter(
          (item) => item.needs.includes(task.id) || item.parent === task.id
        );
        const ids = new Set([
          task.id,
          ...task.needs,
          ...Arr.fromNullishOr(task.parent),
          ...dependents.map((item) => item.id),
        ]);
        const lines = [
          "flowchart TD",
          ...[...ids].map(
            (id) =>
              `${nodeId(id)}["${id}${id === task.id ? " (selected)" : ""}"]`
          ),
        ];
        for (const id of task.needs)
          lines.push(`${nodeId(id)} --> ${nodeId(task.id)}`);
        if (task.parent)
          lines.push(`${nodeId(task.parent)} -.-> ${nodeId(task.id)}`);
        for (const item of dependents) {
          if (item.needs.includes(task.id))
            lines.push(`${nodeId(task.id)} --> ${nodeId(item.id)}`);
          if (item.parent === task.id)
            lines.push(`${nodeId(task.id)} -.-> ${nodeId(item.id)}`);
        }
        return [task.id, lines.join("\n")];
      })
    );
    return {
      tasks,
      groups: groups.map((title, number) => ({ number, title })),
      contracts,
      decisions: tableRows(yield* section("Decisions (changes from the spec)"))
        .slice(1)
        .map(([id, decision, reason]) => ({ id, decision, reason })),
      record: yield* section("System of record (Ratstack)"),
      routing: (yield* section("Orchestration"))
        .split("\nDispatch sketch")[0]
        .trim(),
      criticalPath: yield* section("Critical path"),
      sourceHash,
      hash: sourceHash.slice(0, 12),
      status: /^Status: (.+)$/m.exec(source)?.[1] ?? "See source plan",
      stacks: tasks.flatMap((task) =>
        task.parent ? [[task.parent, task.id]] : []
      ),
      dependencyDiagrams,
      pipelineDiagram:
        'flowchart TD\nsource["Source snapshots"] --> db["Read-only DuckDB tables"]\ndb --> candidates["Detectors or generator"]\ncandidates --> verify["Canonical query evidence and verifier"]\nverify --> pending["Rank and store pending"]\npending --> human["Human review"]\nhuman --> approved["Approved API and poster"]\nhuman --> rejected["Rejected"]\napproved --> recheck["Recheck after refresh"]\nrecheck --> valid["Assertion holds: keep approved"]\nrecheck --> stale["Assertion fails or query errors: stale"]',
    };
  });
