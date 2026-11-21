import assert from "node:assert/strict";
import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import {
  HistoryUnavailable,
  UnknownPlayer,
  UnknownRoster,
} from "@nhl-reddit-stats/history/contracts";
import type { GraphArrays } from "@nhl-reddit-stats/history/shapes";
import { Effect, Exit, Schema, Scope } from "effect";

import {
  MINI_ARRAYS,
  MINI_OPPONENTS,
  MINI_GAMES,
  MINI_SNAPSHOT_ID,
  makeMiniStore,
} from "../../../packages/history/tests/fakes.ts";
import {
  openHistoryStore,
  openScopedHistoryStore,
} from "../src/history-store.ts";

const fake = makeMiniStore();
const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);
const fail = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.flip(effect));

const SERVE_TABLES = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE players (player_id INTEGER PRIMARY KEY, name TEXT, search_name TEXT, position TEXT, first_season INTEGER,
    last_season INTEGER, games INTEGER, points INTEGER, teammates INTEGER);
  CREATE TABLE teams (team_id INTEGER PRIMARY KEY, abbrev TEXT, name TEXT);
  CREATE TABLE games (game_id INTEGER PRIMARY KEY, season_id INTEGER, game_type INTEGER, game_date TEXT, playoff_round INTEGER, cup_final INTEGER);
  CREATE TABLE appearances (player_id INTEGER, game_id INTEGER, team_id INTEGER, PRIMARY KEY (player_id, game_id)) WITHOUT ROWID;
  CREATE TABLE stints (player_id INTEGER, season_id INTEGER, game_type INTEGER, team_id INTEGER, games INTEGER,
    first_game_id INTEGER, last_game_id INTEGER, PRIMARY KEY (player_id, season_id, game_type, team_id));
  CREATE TABLE graph_arrays (name TEXT PRIMARY KEY, bytes BLOB);
`;
const DRESSED_TABLE = `
  CREATE TABLE dressed_goalies (game_id INTEGER NOT NULL, team_id INTEGER NOT NULL, player_id INTEGER NOT NULL,
    PRIMARY KEY (game_id, team_id, player_id)) WITHOUT ROWID;
`;
// Goalies 16 and 17 are on team 3's box score in games E, D, and F (1951020001-3). Goalie 21 is dressed in
// game G but has no credited game, so the serving build leaves him out.
const DRESSED_ROWS: readonly (readonly [number, number, number])[] = [
  1951020001, 1951020002, 1951020003,
].flatMap((gameId) =>
  [16, 17].map((playerId) => [gameId, 3, playerId] as const)
);

const blobs = {
  player_ids: MINI_ARRAYS.playerIds,
  season_ids: MINI_ARRAYS.seasonIds,
  team_ids: MINI_ARRAYS.teamIds,
  edge_a: MINI_ARRAYS.edgeA,
  edge_b: MINI_ARRAYS.edgeB,
  span_start: MINI_ARRAYS.spanStart,
  span_season: MINI_ARRAYS.spanSeason,
  span_kind: MINI_ARRAYS.spanKind,
  span_team: MINI_ARRAYS.spanTeam,
  span_link: MINI_ARRAYS.spanLink,
  span_games: MINI_ARRAYS.spanGames,
  span_first_game: MINI_ARRAYS.spanFirstGame,
  opp_a: MINI_OPPONENTS.oppA,
  opp_b: MINI_OPPONENTS.oppB,
  opp_games: MINI_OPPONENTS.oppGames,
} satisfies Record<string, ArrayBufferView>;

/** Writes the C-mini serving database. Rows come from the in-memory fake so both sides share one source. */
const writeMini = (path: string, withDressed = true) => {
  const db = new DatabaseSync(path);
  db.exec(SERVE_TABLES);
  if (withDressed) {
    db.exec(DRESSED_TABLE);
    for (const row of DRESSED_ROWS)
      db.prepare("INSERT INTO dressed_goalies VALUES (?, ?, ?)").run(...row);
  }
  db.prepare("INSERT INTO meta VALUES (?, ?)").run("schema_version", "1");
  db.prepare("INSERT INTO meta VALUES (?, ?)").run(
    "snapshot_id",
    MINI_SNAPSHOT_ID
  );
  const teams = new Map<number, [string, string]>();
  for (let id = 11; id <= 20; id += 1) {
    const { player, stints } = Effect.runSync(fake.player(id));
    db.prepare("INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      player.playerId,
      player.name,
      player.searchName,
      player.position,
      player.firstSeason,
      player.lastSeason,
      player.games,
      player.points,
      player.teammates
    );
    for (const s of stints) {
      teams.set(s.teamId, [s.teamAbbrev, s.teamName]);
      db.prepare("INSERT INTO stints VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        player.playerId,
        s.seasonId,
        s.gameType,
        s.teamId,
        s.games,
        s.firstGameId,
        s.lastGameId
      );
    }
  }
  for (const [teamId, [abbrev, name]] of teams)
    db.prepare("INSERT INTO teams VALUES (?, ?, ?)").run(teamId, abbrev, name);
  for (const game of MINI_GAMES) {
    // The fake treats the two playoff games as the Final (decision D8 flag).
    db.prepare("INSERT INTO games VALUES (?, ?, ?, ?, ?, ?)").run(
      game.gameId,
      game.seasonId,
      game.gameType,
      game.gameDate,
      game.gameType === 3 ? 1 : null,
      game.gameType === 3 ? 1 : 0
    );
    for (const side of game.sides) {
      for (const playerId of side.credited) {
        db.prepare("INSERT INTO appearances VALUES (?, ?, ?)").run(
          playerId,
          game.gameId,
          side.teamId
        );
      }
    }
  }
  for (const [name, view] of Object.entries(blobs)) {
    db.prepare("INSERT INTO graph_arrays VALUES (?, ?)").run(
      name,
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    );
  }
  db.close();
};

const withDirectory = async (use: (directory: string) => Promise<void>) => {
  const directory = mkdtempSync(join(tmpdir(), "history-store-"));
  try {
    await use(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const withMini = (
  use: (store: Awaited<ReturnType<typeof openMini>>) => Promise<void>,
  withDressed = true
) =>
  withDirectory(async (directory) => {
    const path = join(directory, "nhl-serve.sqlite");
    writeMini(path, withDressed);
    await use(await openMini(path));
  });
const openMini = (path: string) => run(openHistoryStore(path));

const plain = (view: Iterable<number>) => [...view];
const teammateKeys = [
  "playerIds",
  "seasonIds",
  "teamIds",
  "edgeA",
  "edgeB",
  "spanStart",
  "spanSeason",
  "spanKind",
  "spanTeam",
  "spanLink",
  "spanGames",
  "spanFirstGame",
] as const satisfies readonly (keyof GraphArrays)[];

test("loads the snapshot id and teammate arrays equal to the fixture", () =>
  withMini(async (store) => {
    assert.equal(store.snapshotId, MINI_SNAPSHOT_ID);
    for (const key of teammateKeys) {
      assert.deepEqual(
        plain(store.graph.arrays[key]),
        plain(MINI_ARRAYS[key]),
        key
      );
      assert.equal(store.graph.arrays[key].byteOffset, 0, `${key} is aligned`);
    }
    assert.equal(store.graph.indexOf.get(15), 4);
    assert.equal(store.graph.indexOf.get(21), undefined);
  }));

test("opponent arrays load lazily and match the fixture", () =>
  withMini(async (store) => {
    const { oppA, oppB, oppGames } = store.graph.arrays;
    assert.ok(oppA && oppB && oppGames);
    assert.deepEqual(plain(oppA), plain(MINI_OPPONENTS.oppA));
    assert.deepEqual(plain(oppB), plain(MINI_OPPONENTS.oppB));
    assert.deepEqual(plain(oppGames), plain(MINI_OPPONENTS.oppGames));
    assert.equal(store.graph.arrays.oppA, oppA);
  }));

test("searchPlayers folds accents and orders by games then id", () =>
  withMini(async (store) => {
    for (const [query, limit] of [
      ["dvorak", 10],
      ["PLAYER", 10],
      ["player", 2],
      ["  ", 5],
      ["nobody", 5],
    ] as const) {
      assert.deepEqual(
        await run(store.searchPlayers(query, limit)),
        await run(fake.searchPlayers(query, limit)),
        query
      );
    }
    assert.deepEqual(
      (await run(store.searchPlayers("dvorak", 5))).map((row) => row.playerId),
      [19]
    );
  }));

test("player returns the row and ordered stints, and unknown ids fail", () =>
  withMini(async (store) => {
    for (const id of [11, 14, 16, 19])
      assert.deepEqual(
        await run(store.player(id)),
        await run(fake.player(id)),
        String(id)
      );
    assert.equal((await run(store.player(14))).stints.length, 2);
    assert.deepEqual(
      await fail(store.player(21)),
      new UnknownPlayer({ playerId: 21 })
    );
  }));

test("roster lists stint players, and an empty one is UnknownRoster", () =>
  withMini(async (store) => {
    for (const [team, season, type] of [
      [1, 19501951, 2],
      [3, 19511952, 2],
      [2, 19511952, 3],
    ] as const) {
      assert.deepEqual(
        await run(store.roster(team, season, type)),
        await run(fake.roster(team, season, type))
      );
    }
    assert.deepEqual(
      await fail(store.roster(4, 19511952, 2)),
      new UnknownRoster({ teamId: 4, seasonId: 19511952, gameType: 2 })
    );
  }));

test("dressed-only goalies appear once in stints and rosters with zero credited games", () =>
  withDirectory(async (directory) => {
    const path = join(directory, "nhl-serve.sqlite");
    writeMini(path);
    const db = new DatabaseSync(path);
    db.exec(`INSERT INTO games VALUES
      (1952020001, 19521953, 2, '1952-10-01', NULL, 0),
      (1952020002, 19521953, 2, '1952-10-02', NULL, 0);
      INSERT INTO dressed_goalies VALUES
      (1952020001, 2, 16), (1952020002, 2, 16),
      (1952020001, 2, 17), (1952020002, 2, 17)`);
    db.close();
    const store = await openMini(path);
    const existing = await run(fake.player(16));
    const found = await run(store.player(16));
    assert.deepEqual(found.player, existing.player);
    assert.deepEqual(
      found.stints.filter((stint) => stint.teamId === 3),
      existing.stints
    );
    const partner = await run(store.player(17));
    assert.equal(
      partner.stints.length,
      (await run(fake.player(17))).stints.length + 1
    );
    assert.deepEqual(
      partner.stints.find((stint) => stint.teamId === 2),
      {
        seasonId: 19521953,
        gameType: 2,
        teamId: 2,
        teamAbbrev: "BBB",
        teamName: "Bravo Club",
        games: 0,
        firstGameId: 1952020001,
        lastGameId: 1952020002,
      }
    );
    const roster = await run(store.roster(2, 19521953, 2));
    assert.deepEqual(
      roster.filter((row) => row.playerId === 17),
      [{ playerId: 17, name: partner.player.name, position: "G", games: 0 }]
    );
    assert.deepEqual(
      await run(store.roster(3, 19511952, 2)),
      await run(fake.roster(3, 19511952, 2))
    );
    assert.deepEqual(
      roster.map((row) => [row.playerId, row.games]),
      [
        [16, 0],
        [17, 0],
      ]
    );
  }));

test("sharedGames lists one span by kind, oldest first, and agrees with the fake", () =>
  withMini(async (store) => {
    const cases: readonly (readonly [number, number, number, 2 | 3, number])[] =
      [
        [11, 12, 19501951, 2, 1],
        [12, 14, 19511952, 2, 2],
        [14, 15, 19511952, 3, 2],
        [11, 12, 19511952, 2, 1],
        [15, 16, 19501951, 2, 3],
        [16, 17, 19511952, 2, 3],
        [17, 18, 19511952, 2, 3],
        [16, 21, 19511952, 3, 3],
      ];
    for (const [a, b, season, type, team] of cases) {
      for (const kind of ["PlayedWith", "GoaliePartners"] as const) {
        const actual = await run(
          store.sharedGames(a, b, season, type, team, kind)
        ).catch((error: unknown) => error);
        const expected = await run(
          fake.sharedGames(a, b, season, type, team, kind)
        ).catch((error: unknown) => error);
        assert.deepEqual(actual, expected, `${a}-${b} ${kind}`);
      }
    }
    assert.deepEqual(
      (await run(store.sharedGames(11, 12, 19501951, 2, 1, "PlayedWith"))).map(
        (row) => row.gameId
      ),
      [1950020001, 1950020002]
    );
    assert.deepEqual(
      await run(store.sharedGames(11, 12, 19501951, 2, 1, "GoaliePartners")),
      []
    );
    assert.deepEqual(
      await fail(store.sharedGames(11, 99, 19501951, 2, 1, "PlayedWith")),
      new UnknownPlayer({ playerId: 99 })
    );
  }));

test("sharedGames reads dressed goalies for partners, and 21 is in no pair", () =>
  withMini(async (store) => {
    const partners = await run(
      store.sharedGames(16, 17, 19511952, 2, 3, "GoaliePartners")
    );
    assert.deepEqual(
      partners.map((row) => row.gameId),
      [1951020001, 1951020002, 1951020003]
    );
    assert.ok(partners.every((row) => row.link === "GoaliePartners"));
    assert.deepEqual(
      await run(store.sharedGames(16, 17, 19511952, 2, 3, "PlayedWith")),
      []
    );
    // Game D has 17 credited and 16 dressed: partners, not teammates; 17 and 18 are credited together there.
    assert.deepEqual(
      await run(store.sharedGames(17, 18, 19511952, 2, 3, "GoaliePartners")),
      []
    );
    assert.deepEqual(
      await run(store.sharedGames(16, 17, 19511952, 2, 4, "GoaliePartners")),
      []
    );
    assert.deepEqual(
      await fail(store.sharedGames(16, 21, 19511952, 3, 3, "GoaliePartners")),
      new UnknownPlayer({ playerId: 21 })
    );
  }));

test("sharedGames with the same known ID twice is an empty list", () =>
  withMini(async (store) => {
    for (const kind of ["PlayedWith", "GoaliePartners"] as const) {
      assert.deepEqual(
        await run(store.sharedGames(11, 11, 19501951, 2, 1, kind)),
        [],
        kind
      );
      assert.deepEqual(
        await run(store.sharedGames(16, 16, 19511952, 2, 3, kind)),
        [],
        kind
      );
      assert.deepEqual(
        await run(fake.sharedGames(16, 16, 19511952, 2, 3, kind)),
        [],
        kind
      );
    }
    assert.deepEqual(
      await fail(store.sharedGames(99, 99, 19501951, 2, 1, "PlayedWith")),
      new UnknownPlayer({ playerId: 99 })
    );
  }));

test("a serving file without dressed_goalies has no partner games but still lists shared ones", () =>
  withMini(async (store) => {
    assert.deepEqual(await run(store.player(16)), await run(fake.player(16)));
    assert.deepEqual(
      await run(store.roster(3, 19511952, 2)),
      await run(fake.roster(3, 19511952, 2))
    );
    assert.deepEqual(
      await run(store.sharedGames(16, 17, 19511952, 2, 3, "GoaliePartners")),
      []
    );
    assert.deepEqual(
      (await run(store.sharedGames(15, 16, 19501951, 2, 3, "PlayedWith"))).map(
        (row) => row.gameId
      ),
      [1950020001, 1950020002]
    );
  }, false));

test("opposedGames lists games on different teams with each side", () =>
  withMini(async (store) => {
    for (const [a, b] of [
      [12, 16],
      [16, 12],
      [15, 16],
      [11, 19],
      [11, 12],
    ] as const) {
      assert.deepEqual(
        await run(store.opposedGames(a, b)),
        await run(fake.opposedGames(a, b)),
        `${a}v${b}`
      );
    }
    assert.equal((await run(store.opposedGames(14, 16))).length, 4);
    assert.deepEqual(
      await fail(store.opposedGames(21, 16)),
      new UnknownPlayer({ playerId: 21 })
    );
  }));

test("finals groups flagged games by season with participants", () =>
  withMini(async (store) => {
    assert.deepEqual(
      await run(store.finals(1900, 2100)),
      await run(fake.finals(1900, 2100))
    );
    assert.deepEqual(
      await run(store.finals(1952, 1952)),
      await run(fake.finals(1952, 1952))
    );
    assert.deepEqual(await run(store.finals(1953, 2000)), []);
    const [final] = await run(store.finals(1952, 1952));
    assert.deepEqual(
      final.participants.map((p) => p.playerId),
      [14, 15, 16]
    );
  }));

test("a missing file is HistoryUnavailable", () =>
  withDirectory(async (directory) => {
    assert.ok(
      Schema.is(HistoryUnavailable)(
        await fail(openHistoryStore(join(directory, "absent.sqlite")))
      )
    );
  }));

test("a wrong schema version, a missing table, and a missing blob are HistoryUnavailable", () =>
  withDirectory(async (directory) => {
    const mutate = async (name: string, change: (db: DatabaseSync) => void) => {
      const path = join(directory, `${name}.sqlite`);
      writeMini(path);
      const db = new DatabaseSync(path);
      change(db);
      db.close();
      assert.ok(
        Schema.is(HistoryUnavailable)(await fail(openHistoryStore(path))),
        name
      );
    };
    await mutate("version", (db) => {
      db.exec("UPDATE meta SET value = '2' WHERE key = 'schema_version'");
    });
    await mutate("no-snapshot", (db) => {
      db.exec("DELETE FROM meta WHERE key = 'snapshot_id'");
    });
    await mutate("no-table", (db) => {
      db.exec("DROP TABLE stints");
    });
    // Only the Finals query reads `cup_final`, so this fails at open only because every query is compiled there.
    await mutate("no-column", (db) => {
      db.exec("ALTER TABLE games RENAME COLUMN cup_final TO final_flag");
    });
    await mutate("no-blob", (db) => {
      db.exec("DELETE FROM graph_arrays WHERE name = 'edge_a'");
    });
    await mutate("odd-blob", (db) => {
      db.exec(
        "UPDATE graph_arrays SET bytes = x'010203' WHERE name = 'span_games'"
      );
    });
  }));

test("the opponent arrays refuse a file replaced by another snapshot after open", () =>
  withDirectory(async (directory) => {
    const path = join(directory, "nhl-serve.sqlite");
    writeMini(path);
    const store = await openMini(path);
    const replacement = join(directory, "next.sqlite");
    writeMini(replacement);
    const db = new DatabaseSync(replacement);
    db.exec("UPDATE meta SET value = 'next' WHERE key = 'snapshot_id'");
    db.close();
    renameSync(replacement, path);
    assert.throws(() => store.graph.arrays.oppA);
  }));

test("a scoped store closes its connection with the scope", () =>
  withDirectory(async (directory) => {
    const path = join(directory, "nhl-serve.sqlite");
    writeMini(path);
    const store = await run(
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        const opened = yield* openScopedHistoryStore(path).pipe(
          Scope.provide(scope)
        );
        assert.equal((yield* opened.player(11)).player.playerId, 11);
        yield* Scope.close(scope, Exit.void);
        return opened;
      })
    );
    assert.ok(Schema.is(HistoryUnavailable)(await fail(store.player(11))));
  }));
