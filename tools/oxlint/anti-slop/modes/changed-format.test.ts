// oxlint-disable effecttsgo/node-builtin-import, effecttsgo/global-console, effecttsgo/process-env -- a test runner outside any Effect runtime

// Local addition to the vendored copy; see ../UPSTREAM.md.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CHANGES_ENV, changedLines, changesJson } from "./changed.ts";

const modules = fileURLToPath(new URL("../../../../node_modules", import.meta.url));
const dir = realpathSync(mkdtempSync(join(tmpdir(), "anti-slop-changed-format-")));
const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
const changes = (): unknown => JSON.parse(changesJson(dir)).files;
const env = { ...process.env };
try {
	delete process.env.ANTI_SLOP_BASE;
	git("init", "-q", "-b", "main");
	git("config", "user.email", "test@example.com");
	git("config", "user.name", "test");
	symlinkSync(modules, join(dir, "node_modules"));
	writeFileSync(join(dir, ".gitignore"), "node_modules\n");
	writeFileSync(join(dir, "reformatted.ts"), "const a = 1\nconst b = 2\n");
	writeFileSync(join(dir, "edited.ts"), "const a = 1\nconst b = 2\nconst c = 3\n");
	writeFileSync(join(dir, "unformatted.ts"), "const a = 1\nconst b = 2\n");
	git("add", ".");
	git("commit", "-q", "-m", "base");
	git("checkout", "-q", "-b", "feature");
	writeFileSync(join(dir, "reformatted.ts"), "const a = 1;\nconst b = 2;\n");
	writeFileSync(join(dir, "edited.ts"), "const a = 1;\nconst b = 20;\nconst c = 3;\n");
	writeFileSync(join(dir, "unformatted.ts"), "const a = 1\nconst b = 20\n");

	// Without an Oxfmt config every reformatted line counts as changed.
	assert.deepEqual(changes(), { "edited.ts": [1, 2, 3], "reformatted.ts": [1, 2], "unformatted.ts": [2] });
	console.log("ok - without an Oxfmt config, reformatted lines count as changed");

	writeFileSync(join(dir, ".oxfmtrc.json"), JSON.stringify({ semi: true }));
	git("add", ".oxfmtrc.json");
	git("commit", "-q", "-m", "format config");
	// Only the edit counts; a file the working tree has not formatted keeps its raw diff.
	const files = changes() as Record<string, unknown>;
	assert.deepEqual(files["edited.ts"], [2]);
	assert.deepEqual(files["reformatted.ts"], []);
	assert.deepEqual(files["unformatted.ts"], [2]);
	console.log("ok - with an Oxfmt config, lines changed only by formatting do not count as changed");

	// Inside the linter, without precomputed changes, each file is formatted when a rule asks for it.
	delete process.env[CHANGES_ENV];
	const warnings: string[] = [];
	const lines = (file: string) => [...changedLines(join(dir, file), undefined, (message) => warnings.push(message))];
	assert.deepEqual(lines("edited.ts"), [2]);
	assert.deepEqual(lines("reformatted.ts"), []);
	assert.deepEqual(lines("unformatted.ts"), [2]);
	assert.deepEqual(warnings, []);
	console.log("ok - changedLines drops formatting-only lines from the file it is asked about");
} finally {
	process.env = env;
	rmSync(dir, { recursive: true, force: true });
}
