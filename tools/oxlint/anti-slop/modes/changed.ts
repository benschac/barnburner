// oxlint-disable effecttsgo/node-builtin-import, effecttsgo/process-env, effecttsgo/global-date -- runs inside oxlint's plugin host, outside any Effect runtime

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";

import { errorMessage } from "../shared/error-message.ts";

/**
 * How a rule picks what to check, set in its own options. `"all"` (the default) checks every line;
 * `"changed"` checks only lines that differ from the merge base of `HEAD` and the default branch,
 * so findings on untouched lines are dropped.
 */
export type Mode = "all" | "changed";

/** Changed line numbers of one file, or `"all"` when every line counts as changed. */
export type ChangedLines = ReadonlySet<number> | "all";

/** Tried in order after `refs/remotes/origin/HEAD` when resolving the default branch. */
export const DEFAULT_BRANCHES: ReadonlyArray<string> = ["origin/main", "origin/master", "main", "master"];

const BASE_ENV = "ANTI_SLOP_BASE";

/**
 * Names a JSON file of changes that `modes/with-changes.ts` computed before starting the linter.
 * When it is set, rules read it instead of running git: a type-aware linter on Linux can be too
 * large to fork, and git then fails with ENOMEM.
 */
export const CHANGES_ENV = "ANTI_SLOP_CHANGES";

interface SavedChanges {
	readonly root: string;
	/** The rule-level `base` the file was computed for; `null` means none, so `ANTI_SLOP_BASE` or the default branch. */
	readonly base: string | null;
	readonly files: Readonly<Record<string, ReadonlyArray<number> | "all">> | null;
}

interface RepoChanges {
	readonly root: string;
	/** `null` before the first commit, when every line of every file is new. */
	readonly files: Map<string, ChangedLines> | null;
	readonly computedAt: number;
	/** The merge base the diff ran against, and the files whose lines formatting has not yet been taken out of. */
	readonly unformatted: { readonly mergeBase: string; readonly paths: Set<string> } | null;
}

const git = (cwd: string, args: ReadonlyArray<string>): string =>
	execFileSync("git", ["-c", "core.quotePath=false", ...args], {
		cwd,
		encoding: "utf8",
		maxBuffer: 256 * 1024 * 1024,
		stdio: ["ignore", "pipe", "pipe"],
	});

const succeeds = (cwd: string, args: ReadonlyArray<string>): boolean => {
	try {
		git(cwd, args);
		return true;
	} catch {
		return false;
	}
};

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** Parses `git diff -U0` output into the new-side line numbers each file changed. */
export function parseDiff(diff: string): Map<string, Set<number>> {
	const files = new Map<string, Set<number>>();
	let current: Set<number> | null = null;
	for (const line of diff.split("\n")) {
		if (line.startsWith("+++ ")) {
			const target = line.slice(4);
			current = null;
			if (target.startsWith("b/")) {
				current = files.get(target.slice(2)) ?? new Set();
				files.set(target.slice(2), current);
			}
			continue;
		}
		const hunk = current === null ? null : HUNK.exec(line);
		if (hunk === null || current === null) continue;
		const start = Number(hunk[1]);
		const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
		// A pure deletion has no new lines, so the lines on either side of the gap count as changed.
		if (count === 0) {
			current.add(start);
			current.add(start + 1);
		}
		for (let offset = 0; offset < count; offset++) current.add(start + offset);
	}
	return files;
}

/**
 * The default branch: what `refs/remotes/origin/HEAD` points at (`origin/main` or
 * `origin/master`), else the first of `DEFAULT_BRANCHES` that names a commit, else `null`.
 */
export function defaultBase(cwd: string): string | null {
	try {
		const ref = git(cwd, ["symbolic-ref", "-q", "refs/remotes/origin/HEAD"]).trim();
		const name = ref.replace(/^refs\/remotes\//, "");
		if (name !== "" && succeeds(cwd, ["rev-parse", "--verify", "-q", `${name}^{commit}`])) return name;
	} catch {
		// No origin/HEAD; fall through to the fixed list.
	}
	return DEFAULT_BRANCHES.find((branch) => succeeds(cwd, ["rev-parse", "--verify", "-q", `${branch}^{commit}`])) ?? null;
}

/** The rule's `base` option when given, then `ANTI_SLOP_BASE`, then the default branch. */
export function resolveBase(cwd: string, base: string | undefined): string | null {
	return base?.trim() || process.env[BASE_ENV]?.trim() || defaultBase(cwd);
}

// The language server lints edits for as long as it runs, so its diffs go stale; a CLI run sees
// one working tree and computes each diff once.
const MAX_AGE_MS = process.argv.includes("--lsp") ? 1000 : Infinity;

const rootByDir = new Map<string, string | null>();
const changesByKey = new Map<string, RepoChanges | null>();

/** Oxfmt config files looked for at the repository root. */
const OXFMT_CONFIGS: ReadonlyArray<string> = ["oxfmt.config.ts", "oxfmt.config.mts", "oxfmt.config.js", "oxfmt.config.mjs", ".oxfmtrc.json", ".oxfmtrc.jsonc"];

/** Reads each `<commit>:<path>` blob in one `git cat-file --batch`; a path missing at the commit is left out. */
function blobsAt(root: string, commit: string, paths: ReadonlyArray<string>): Map<string, Buffer> {
	const output = execFileSync("git", ["cat-file", "--batch"], {
		cwd: root,
		input: paths.map((path) => `${commit}:${path}\n`).join(""),
		maxBuffer: 1024 * 1024 * 1024,
		stdio: ["pipe", "pipe", "pipe"],
	});
	const blobs = new Map<string, Buffer>();
	let offset = 0;
	for (const path of paths) {
		const end = output.indexOf(10, offset);
		if (end === -1) break;
		const header = output.subarray(offset, end).toString("utf8").split(" ");
		offset = end + 1;
		if (header[1] !== "blob") continue;
		const size = Number(header[2]);
		blobs.set(path, output.subarray(offset, offset + size));
		offset += size + 1;
	}
	return blobs;
}

/**
 * Drops lines whose only change since the merge base is formatting, so a repository-wide format
 * does not make every line count as changed. Applies when the repository root has an Oxfmt config
 * and `node_modules/.bin/oxfmt`: both sides of each changed file are formatted in a scratch
 * directory and diffed again. A file that is not formatted in the working tree keeps its raw diff,
 * because formatted line numbers would not match it, and any failure keeps the raw diff for every
 * file, which can only check more lines, never fewer.
 *
 * Local addition to the vendored copy; see ../UPSTREAM.md.
 */
function withoutFormatting(root: string, mergeBase: string, files: Map<string, ChangedLines>): Map<string, ChangedLines> {
	const config = OXFMT_CONFIGS.map((name) => join(root, name)).find((path) => existsSync(path));
	const oxfmt = join(root, "node_modules", ".bin", "oxfmt");
	const paths = [...files].flatMap(([path, lines]) => (lines === "all" ? [] : [path]));
	if (config === undefined || !existsSync(oxfmt) || paths.length === 0) return files;
	const scratch = mkdtempSync(join(tmpdir(), "anti-slop-format-"));
	try {
		const base = blobsAt(root, mergeBase, paths);
		const current = new Map<string, Buffer>();
		for (const [path, blob] of base) {
			if (!existsSync(join(root, path))) continue;
			current.set(path, readFileSync(join(root, path)));
			for (const [side, content] of [["base", blob], ["current", current.get(path)]] as const) {
				mkdirSync(dirname(join(scratch, side, path)), { recursive: true });
				writeFileSync(join(scratch, side, path), content ?? "");
			}
		}
		// Oxfmt exits non-zero when a file does not parse; it still writes every file it formatted.
		spawnSync(oxfmt, ["-c", config, "--no-error-on-unmatched-pattern", "base", "current"], { cwd: scratch, stdio: "ignore" });
		for (const [path, content] of current) {
			if (readFileSync(join(scratch, "current", path)).equals(content)) continue;
			current.delete(path);
			rmSync(join(scratch, "base", path));
			rmSync(join(scratch, "current", path));
		}
		const result = spawnSync(
			"git",
			["-c", "core.quotePath=false", "diff", "--no-index", "-U0", "--no-color", "--no-ext-diff", "--no-renames", "--src-prefix=a/", "--dst-prefix=b/", "base", "current"],
			{ cwd: scratch, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
		);
		// `git diff --no-index` exits 1 when the sides differ and 2 or more on failure.
		if (result.status === null || result.status > 1) return files;
		const formatted = parseDiff(result.stdout);
		const next = new Map(files);
		for (const path of current.keys()) next.set(path, formatted.get(`current/${path}`) ?? new Set());
		return next;
	} catch {
		return files;
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}

/**
 * The changes against the merge base. With `format: "now"`, lines changed only by formatting are
 * dropped from every file at once; with `"later"`, `changedLines` drops them from each file it is
 * asked about, so a linter run over a few untracked fixture files never formats the whole diff.
 */
function computeChanges(root: string, base: string | undefined, format: "now" | "later"): RepoChanges {
	const computedAt = Date.now();
	if (!succeeds(root, ["rev-parse", "--verify", "-q", "HEAD"])) return { root, files: null, computedAt, unformatted: null };
	const ref = resolveBase(root, base);
	if (ref === null) {
		throw new Error(`no default branch found (origin/HEAD, ${DEFAULT_BRANCHES.join(", ")}); set ${BASE_ENV} or the rule's base option`);
	}
	const mergeBase = git(root, ["merge-base", ref, "HEAD"]).trim();
	// The working tree against the merge base covers commits on this branch, staged, and unstaged
	// edits together.
	const diff = git(root, ["diff", "-U0", "--no-color", "--no-ext-diff", "--no-renames", "--src-prefix=a/", "--dst-prefix=b/", mergeBase, "--"]);
	const raw = new Map<string, ChangedLines>(parseDiff(diff));
	const files = format === "now" ? withoutFormatting(root, mergeBase, raw) : raw;
	const unformatted = format === "now" ? null : { mergeBase, paths: new Set(raw.keys()) };
	const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
	for (const file of untracked.split("\0").filter(Boolean)) files.set(file, "all");
	return { root, files, computedAt, unformatted };
}

let saved: { readonly path: string; readonly changes: SavedChanges } | null = null;

/** The precomputed changes for `base`, `null` when the file cannot be read, or `undefined` when there is none for `base`. */
function savedChanges(base: string | undefined, warn: (message: string) => void): RepoChanges | null | undefined {
	const path = process.env[CHANGES_ENV]?.trim() ?? "";
	if (path === "") return undefined;
	try {
		if (saved?.path !== path) saved = { path, changes: JSON.parse(readFileSync(path, "utf8")) as SavedChanges };
	} catch (error) {
		warn(`changed-lines mode could not read ${CHANGES_ENV}=${path}, checking every line: ${errorMessage(error).trim()}`);
		return null;
	}
	const { root, files } = saved.changes;
	if (saved.changes.base !== (base ?? null)) return undefined;
	return {
		root,
		files: files === null ? null : new Map(Object.entries(files).map(([file, lines]) => [file, lines === "all" ? "all" : new Set(lines)])),
		computedAt: Date.now(),
		unformatted: null,
	};
}

/** The changes of the repository containing `dir`, as the JSON `CHANGES_ENV` names. Throws when git cannot answer. */
export function changesJson(dir: string, base?: string): string {
	const root = realpathSync(git(dir, ["rev-parse", "--show-toplevel"]).trim());
	const { files } = computeChanges(root, base, "now");
	const saved: SavedChanges = {
		root,
		base: base ?? null,
		files: files === null ? null : Object.fromEntries([...files].map(([file, lines]) => [file, lines === "all" ? "all" : [...lines]])),
	};
	return JSON.stringify(saved);
}

function repoChanges(dir: string, base: string | undefined, warn: (message: string) => void): RepoChanges | null {
	const precomputed = savedChanges(base, warn);
	if (precomputed !== undefined) return precomputed;
	let root = rootByDir.get(dir);
	try {
		if (root === undefined) {
			root = realpathSync(git(dir, ["rev-parse", "--show-toplevel"]).trim());
			rootByDir.set(dir, root);
		}
		if (root === null) return null;
		const key = `${base ?? ""}\0${root}`;
		const cached = changesByKey.get(key);
		if (cached === null) return null;
		if (cached !== undefined && Date.now() - cached.computedAt <= MAX_AGE_MS) return cached;
		try {
			const changes = computeChanges(root, base, "later");
			changesByKey.set(key, changes);
			return changes;
		} catch (error) {
			changesByKey.set(key, null);
			throw error;
		}
	} catch (error) {
		if (root === undefined) rootByDir.set(dir, null);
		warn(`changed-lines mode could not diff ${dir}, checking every line: ${errorMessage(error).trim()}`);
		return null;
	}
}

/**
 * The lines of a file changed against the merge base of `HEAD` and `base` (default: see
 * `resolveBase`), computed once per repository per run. An empty set means the file is unchanged.
 * Untracked files, and every file before the first commit, count as entirely changed. When git
 * cannot answer, every line counts as changed and `warn` is told why, so a broken diff never
 * silently turns checks off.
 */
export function changedLines(filename: string, base: string | undefined, warn: (message: string) => void): ChangedLines {
	let file: string;
	try {
		file = realpathSync(filename);
	} catch {
		return "all";
	}
	const changes = repoChanges(dirname(file), base, warn);
	if (changes === null || changes.files === null) return "all";
	const path = relative(changes.root, file).split(sep).join("/");
	const lines = changes.files.get(path) ?? new Set();
	if (changes.unformatted === null || !changes.unformatted.paths.delete(path)) return lines;
	const formatted = withoutFormatting(changes.root, changes.unformatted.mergeBase, new Map([[path, lines]])).get(path) ?? lines;
	changes.files.set(path, formatted);
	return formatted;
}

export function overlaps(lines: ChangedLines, start: number, end: number): boolean {
	if (lines === "all") return true;
	for (let line = start; line <= end; line++) if (lines.has(line)) return true;
	return false;
}
