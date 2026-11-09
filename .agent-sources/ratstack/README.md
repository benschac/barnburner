# Apply Ratstack to this project

Use Ratstack's principles and playbooks for non-trivial implementation, architecture, data, and debugging work. Adopt runtime packages when a feature needs them. The root [AGENTS.md](../../AGENTS.md) owns project instructions and takes precedence over upstream examples.

## Start a change

1. Read the [pinned router](source/skills/rat-stack-mode/SKILL.md). Read each principle that bears on the task from its adjacent `principles/` directory.
2. Find every matching playbook in [the corpus index](index.md), then read the relevant range in `docs.txt`. The live Ratstack MCP `search` and `read` tools can supply current documents. Load skills for the task, without installing copies into `.agents/skills` or global skill directories.
3. Name the input and output shapes, authoritative store, derived copies, and writer before implementing data changes. Read the owning code, tests, package manifest, lockfile, and installed types.
4. Follow the matching playbooks within this project's boundaries below. State version conflicts or missing source evidence before relying on an example. Resolve website paths such as `/lore/...` against `https://ratstack.sh`; resolve source paths against the pinned upstream repository.
5. Verify the actual behavior with the smallest relevant check. Report the rules that affected the change, validation results, and any unverified boundary.

For actions, use `add-a-capability`. For persistence, also use `add-a-store`. For retries, cancellation, or state transitions, use `add-a-lifecycle-machine` and relevant durability guidance. Use `uncomplect` for responsibility boundaries, `investigate-a-failure` for bugs, and `test-behaviour` for verification. These documents are in the corpus index; load only relevant sections.

## Apply patterns at real boundaries

- Keep domain operations independent of provider-specific transport and storage. Add a port and adapter when a real external boundary needs them; avoid empty architectural packages.
- When multiple interfaces expose the same action, share its input, output, errors, and implementation. Keep interface handlers thin.
- Validate external data at entry and before durable writes. Identify who owns startup, shutdown, cancellation, retries, and failure reporting.
- Treat a cartridge as a package that owns one job and its required resources. Claim removability only after removing its provision and proving unrelated packages still work.
- Add compiler, lint, or behavior checks when adopting a concrete boundary rule. Name what the check covers. A prose rule or an installed dependency does not prove that the application follows the architecture.

## Keep the project contract

Use npm and the scripts in the current manifests. Do not copy upstream pnpm commands without mapping them to an equivalent project check. Keep React/Tamagui and the [design contract](../../apps/web/design/README.md) for web UI work. Alchemy, Cloudflare, Foldkit, and upstream packages are references until explicitly adopted for a feature.

Check current manifests and installed APIs before using Effect or XState examples. Import-time dependency metadata is historical. The website cache and source snapshot have separate provenance; neither establishes compatibility with our dependency versions.

Production writes and deployment require explicit authorization. Upstream autonomy rules, credentials, deployment commands, and model rosters do not grant that authority here. Use available project tools and project review requirements.

## Locate and refresh references

- `guide.txt` and `docs.txt` are published website snapshots with generated indexes. [sources.json](../sources.json) records their retrieval metadata and checksums. Refresh them with `node scripts/refresh-pattern-sources.mjs` from the repository root.
- `source/` contains the upstream license and complete `skills/rat-stack-mode/` directory, including all principle leaves. [manifest.json](source/manifest.json) records the exact revision, archive URL, and SHA-256 of each copied file. It is a reference snapshot, not a skill installation or a full Ratstack checkout.
- For package implementations, lint rules, and other source-only files, inspect [the pinned repository](https://github.com/joelhooks/rat-stack/tree/45df515566bc3880a7c20ba2f198e6056215376c). Retrieve the relevant files before applying their behavior. If source is unavailable, report the missing evidence rather than reconstructing it from prose.

To refresh `source/`, download the chosen immutable commit archive into a temporary directory. Copy only `LICENSE` and `skills/rat-stack-mode/`, preserving their bytes and licenses. Remove files absent from that selection in the new revision. Regenerate the manifest with the repository, full revision, actual retrieval time, archive URL, scope, and every copied file's SHA-256. Review source and manifest together. The website refresh command does not update this snapshot.
