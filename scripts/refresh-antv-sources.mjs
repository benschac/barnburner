import { createHash } from "node:crypto";

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Option, Path, Predicate, Schema } from "effect";
import { Command, Flag } from "effect/cli";

import { loggerLayer } from "../lib/logger.mjs";

// Caches the AntV G2 5 and G6 5 documentation and the antvis/chart-visualization-skills skills.
// Every page listed in a site's llms.txt is fetched in English (/en/) when that page exists and
// in Chinese (/zh/) otherwise. Nothing is written until every download has succeeded and parsed.
// The listed version must equal the pinned one below; --accept-version x.y.z moves the pin for one run.
// The skills stay at the commit recorded in sources.json; --update-skills moves them to HEAD.
class SourceRefreshFailed extends Schema.TaggedError()("SourceRefreshFailed", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

const AcceptedVersion = Schema.String.check(
  Schema.isPattern(/^\d+\.\d+\.\d+$/)
);
const Sources = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Any));

const skillsRepo = "antvis/chart-visualization-skills";
const skillNames = ["antv-g2-chart", "antv-g6-graph"];
const libraries = [
  {
    key: "antv-g2",
    name: "G2",
    dir: "g2",
    site: "https://g2.antv.antgroup.com",
    licenceUrl: "https://raw.githubusercontent.com/antvis/G2/v5/LICENSE",
    pinned: "5.4.8",
  },
  {
    key: "antv-g6",
    name: "G6",
    dir: "g6",
    site: "https://g6.antv.antgroup.com",
    licenceUrl: "https://raw.githubusercontent.com/antvis/G6/v5/LICENSE",
    pinned: "5.1.1",
  },
];
const concurrency = 8;
const attempts = 3;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isMit = (bytes) => /^(The )?MIT License/.test(bytes.toString("utf8"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolves undefined for a 404; retries other failures.
const get = async (url, markdown = false) => {
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60_000),
      });
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (
        markdown &&
        !(response.headers.get("content-type") ?? "").includes("markdown")
      )
        return undefined;
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      failure = error;
      await sleep(500 * attempt);
    }
  }
  throw new Error(`Download failed for ${url}: ${failure.message}`);
};
const download = async (url) => {
  const bytes = await get(url);
  if (!bytes) throw new Error(`Download failed: not found: ${url}`);
  return bytes;
};

// A page is usable when it has front matter with the expected language and version.
const parsePage = (bytes, language, version) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(bytes.toString("utf8"));
  if (!match) return undefined;
  const field = (name) =>
    new RegExp(`^${name}: "(.*)"$`, "m").exec(match[1])?.[1];
  if (field("language") !== language) return undefined;
  if (field("version") !== version)
    throw new Error(
      `Page version ${field("version")} differs from the accepted version ${version}; existing cache was not changed`
    );
  const body = bytes
    .toString("utf8")
    .slice(match[0].length)
    .replace(/^\s*\[[^\]\n]*\]\(\/llms\.txt\)\s*\n/, "")
    .trim();
  return { title: (field("title") ?? "").replaceAll('\\"', '"'), body };
};

const fetchPage = async (library, path, version) => {
  for (const language of ["en", "zh"]) {
    const url = `${library.site}/${language}${path}`;
    const bytes = await get(url, true);
    const page = bytes && parsePage(bytes, language, version);
    if (page) return { ...page, language, url };
  }
  throw new Error(
    `${library.name} page ${path} is available in neither English nor Chinese; existing cache was not changed`
  );
};

const mapLimit = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
};

// Downloads and parses everything; resolves the files to write and the sources.json entries.
const collect = async ({ updateSkills, acceptVersion, sources }) => {
  const fetchedAt = new Date().toISOString();
  const files = new Map();
  const entries = {};

  for (const library of libraries) {
    const listing = (await download(`${library.site}/llms.txt`)).toString(
      "utf8"
    );
    const version = /^- Current version: (\S+)$/m.exec(listing)?.[1];
    if (!listing.startsWith(`# ${library.name}\n`) || !version) {
      throw new Error(
        `Unexpected ${library.name} listing format; existing cache was not changed`
      );
    }
    if (version !== library.pinned && version !== acceptVersion) {
      throw new Error(
        `${library.name} listing reports version ${version} but the pinned version is ${library.pinned}; rerun with --accept-version ${version} to move the pin. Existing cache was not changed`
      );
    }
    const paths = [
      ...new Set(
        [
          ...listing.matchAll(/^- \[[^\]]*\]\(\/(?:zh|en)(\/[^)]+\.md)\)/gm),
        ].map((match) => match[1])
      ),
    ];
    if (paths.length < 10)
      throw new Error(
        `Unexpected ${library.name} listing format; existing cache was not changed`
      );
    const pages = await mapLimit(paths, concurrency, (path) =>
      fetchPage(library, path, version)
    );

    const lines = [
      `# ${library.name} — Documentation`,
      "",
      `- Source: ${library.site} (llms.txt order; English pages where they exist, Chinese otherwise)`,
      `- Version: ${version}`,
      "",
    ];
    const rows = [];
    const count = { en: 0, zh: 0 };
    pages.forEach((page, i) => {
      count[page.language]++;
      const start = lines.length + 1;
      lines.push(
        `#### ${page.title}`,
        `<!-- ${page.url} -->`,
        "",
        ...page.body.split("\n"),
        ""
      );
      rows.push({
        category: paths[i].split("/")[1],
        title: page.title.replaceAll("|", "/"),
        language: page.language,
        path: paths[i],
        start,
        end: lines.length - 1,
      });
    });
    const document = Buffer.from(`${lines.join("\n")}\n`);
    const index = [
      `# ${library.name} topic index`,
      "",
      "Generated from the official pages. Line ranges refer to [docs.txt](docs.txt).",
      "Read [../../README.md](../../README.md) for version checks and refresh instructions.",
      "Search this index first, then read only the relevant line range.",
      "",
      "| Category | Topic | Language | Path | Start line | End line |",
      "| --- | --- | --- | --- | ---: | ---: |",
      ...rows.map(
        (row) =>
          `| ${row.category} | ${row.title} | ${row.language} | ${row.path} | ${row.start} | ${row.end} |`
      ),
      "",
    ].join("\n");
    const licence = await download(library.licenceUrl);
    files.set(`antv/${library.dir}/docs.txt`, document);
    files.set(`antv/${library.dir}/index.md`, Buffer.from(index));
    files.set(`antv/${library.dir}/LICENSE`, licence);
    entries[library.key] = {
      url: `${library.site}/llms.txt`,
      fetchedAt,
      retrieval: "https",
      sha256: sha256(document),
      bytes: document.length,
      package: `@antv/${library.dir}`,
      targetPackageVersion: library.pinned,
      upstreamVersion: version,
      upstreamRevision: null,
      pages: { en: count.en, zh: count.zh },
      licence: {
        spdx: isMit(licence) ? "MIT" : "UNVERIFIED",
        url: library.licenceUrl,
        file: `antv/${library.dir}/LICENSE`,
        sha256: sha256(licence),
      },
      compatibility:
        version === library.pinned
          ? `Matches the pinned ${library.pinned}.`
          : `Site documents ${version}; the plan pins ${library.pinned}. Check before use.`,
      document: `antv/${library.dir}/docs.txt`,
      index: `antv/${library.dir}/index.md`,
    };
  }

  const pinned = sources["antv-skills"]?.upstreamRevision;
  let revision = pinned;
  if (updateSkills || !revision) {
    const head = JSON.parse(
      (
        await download(
          `https://api.github.com/repos/${skillsRepo}/commits/HEAD`
        )
      ).toString("utf8")
    );
    revision = head.sha;
  }
  if (!/^[0-9a-f]{40}$/.test(revision))
    throw new Error(
      "Unexpected commit response; existing cache was not changed"
    );
  const raw = (path) =>
    `https://raw.githubusercontent.com/${skillsRepo}/${revision}/${path}`;
  const skillFiles = {};
  for (const name of skillNames) {
    const bytes = await download(raw(`skills/${name}/SKILL.md`));
    if (!bytes.toString("utf8").startsWith(`---\nname: ${name}\n`))
      throw new Error(
        `Unexpected ${name} skill format; existing cache was not changed`
      );
    files.set(`antv/skills/${name}/SKILL.md`, bytes);
    skillFiles[name] = {
      file: `antv/skills/${name}/SKILL.md`,
      sha256: sha256(bytes),
      bytes: bytes.length,
    };
  }
  const skillsLicence = await download(raw("LICENSE"));
  files.set("antv/skills/LICENSE", skillsLicence);
  entries["antv-skills"] = {
    url: `https://github.com/${skillsRepo}/tree/${revision}/skills`,
    fetchedAt,
    retrieval: "https",
    upstreamRevision: revision,
    package: null,
    targetPackageVersion: null,
    upstreamVersion: null,
    language: "en",
    licence: {
      spdx: isMit(skillsLicence) ? "MIT" : "UNVERIFIED",
      url: raw("LICENSE"),
      file: "antv/skills/LICENSE",
      sha256: sha256(skillsLicence),
    },
    compatibility:
      "Skills for G2 5 and G6 5, pinned to a commit. Check their API claims against the cached documentation above.",
    skills: skillFiles,
  };

  return { files, entries, revision };
};

const program = Effect.fn("refreshAntvSources")(function* ({
  updateSkills,
  acceptVersion,
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.resolve(
    yield* path.fromFileUrl(new URL("../", import.meta.url))
  );
  const sourcesFile = path.join(root, ".agent-sources", "sources.json");
  const sources = (yield* fs.exists(sourcesFile))
    ? yield* Schema.decodeUnknownEffect(Sources)(
        yield* fs.readFileString(sourcesFile)
      )
    : {};
  const { files, entries, revision } = yield* Effect.tryPromise({
    try: () =>
      collect({
        updateSkills,
        acceptVersion: Option.getOrUndefined(acceptVersion),
        sources,
      }),
    catch: (cause) =>
      new SourceRefreshFailed({
        message: Predicate.isError(cause) ? cause.message : "Refresh failed",
        cause,
      }),
  });
  yield* Effect.forEach(
    [...files],
    ([file, content]) => {
      const target = path.join(root, ".agent-sources", file);
      return fs
        .makeDirectory(path.dirname(target), { recursive: true })
        .pipe(Effect.andThen(fs.writeFile(target, content)));
    },
    { discard: true }
  );
  yield* fs.writeFileString(
    sourcesFile,
    `${JSON.stringify({ ...sources, ...entries }, null, 2)}\n`
  );
  yield* Effect.logInfo(
    `Cached G2 ${entries["antv-g2"].upstreamVersion} (${entries["antv-g2"].pages.en} en / ${entries["antv-g2"].pages.zh} zh pages), G6 ${entries["antv-g6"].upstreamVersion} (${entries["antv-g6"].pages.en} en / ${entries["antv-g6"].pages.zh} zh pages), and skills at ${revision.slice(0, 12)}`
  );
});

const command = Command.make(
  "refresh-antv-sources",
  {
    updateSkills: Flag.Boolean("update-skills").pipe(
      Flag.withDescription("Move the skills to the upstream HEAD commit"),
      Flag.withDefault(false)
    ),
    acceptVersion: Flag.String("accept-version").pipe(
      Flag.withDescription(
        "Accept this x.y.z listing version instead of the pinned one for one run"
      ),
      Flag.withSchema(AcceptedVersion),
      Flag.optional
    ),
  },
  program
).pipe(
  Command.withDescription(
    "Cache the AntV G2 5 and G6 5 documentation and skills"
  )
);

command.pipe(
  Command.run({ version: "1.0.0" }),
  Effect.provide([NodeServices.layer, loggerLayer]),
  NodeRuntime.runMain
);
