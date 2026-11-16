import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Answer, Row } from '../src/shapes.ts'
import { SqlError } from '../src/shapes.ts'
import { coverageSql, makeAnswerTool, runAnswer } from '../src/tools/answer.ts'
import { fakeDb, fakeGuard } from './fakes.ts'

const team = 'NJD'
const query = 'SELECT team, wins FROM standings_daily'
const rows: Row[] = [
  { team: 'NJD', wins: 10 },
  { team: 'NYR', wins: null },
]
const coverageRow: Row[] = [{ archived: 4, finals: 6 }]

const setup = (
  responses: Record<string, Row[] | SqlError>,
  guard = fakeGuard({ ok: true, touchesBoxscores: false }),
) => {
  const answers: Answer[] = []
  const deps = {
    db: fakeDb(responses),
    guard,
    team,
    onAnswer: (a: Answer) => {
      answers.push(a)
    },
  }
  return { deps, answers }
}

test('returns the named cell and records it without coverage', async () => {
  const { deps, answers } = setup({ [query]: rows })
  assert.equal(await runAnswer(deps, { query, row: 0, column: 'wins' }), 'ok')
  assert.deepEqual(answers, [{ value: 10, query }])
})

test('a null cell is a valid answer', async () => {
  const { deps, answers } = setup({ [query]: rows })
  assert.equal(await runAnswer(deps, { query, row: 1, column: 'wins' }), 'ok')
  assert.deepEqual(answers, [{ value: null, query }])
})

test('guard rejection returns ERROR text and records nothing', async () => {
  const { deps, answers } = setup({}, fakeGuard({ ok: false, reason: 'not a SELECT' }))
  assert.equal(await runAnswer(deps, { query: 'DELETE FROM x', row: 0, column: 'a' }), 'ERROR: not a SELECT')
  assert.deepEqual(answers, [])
})

test('SqlError from the canonical query returns ERROR text', async () => {
  const { deps, answers } = setup({ [query]: new SqlError({ message: 'syntax error', sql: query }) })
  assert.equal(await runAnswer(deps, { query, row: 0, column: 'wins' }), 'ERROR: syntax error')
  assert.deepEqual(answers, [])
})

test('row out of range returns ERROR text', async () => {
  const { deps, answers } = setup({ [query]: rows })
  assert.match(await runAnswer(deps, { query, row: 2, column: 'wins' }), /^ERROR: row 2 is out of range/)
  assert.match(await runAnswer(deps, { query, row: -1, column: 'wins' }), /^ERROR: row -1/)
  assert.match(await runAnswer(deps, { query, row: 0.5, column: 'wins' }), /^ERROR: row 0.5/)
  assert.deepEqual(answers, [])
})

test('unknown column returns ERROR text listing the columns', async () => {
  const { deps, answers } = setup({ [query]: rows })
  assert.equal(
    await runAnswer(deps, { query, row: 0, column: 'goals' }),
    'ERROR: column goals is not in the result (columns: team, wins)',
  )
  assert.match(await runAnswer(deps, { query, row: 0, column: 'constructor' }), /^ERROR: column constructor is not in the result/)
  assert.deepEqual(answers, [])
})

test('touching box scores attaches coverage from the fixed SQL text', async () => {
  const boxQuery = 'SELECT team, wins FROM skater_games'
  const { deps, answers } = setup(
    {
      [boxQuery]: rows,
      [coverageSql(team)]: coverageRow,
    },
    fakeGuard({ ok: true, touchesBoxscores: true }),
  )
  assert.equal(await runAnswer(deps, { query: boxQuery, row: 0, column: 'wins' }), 'ok')
  assert.deepEqual(answers, [{ value: 10, query: boxQuery, coverage: { archived: 4, finals: 6 } }])
})

test('the coverage SQL is exactly the documented text', () => {
  assert.equal(coverageSql('NJD'), "SELECT archived, finals FROM boxscore_coverage WHERE team = 'NJD'")
})

test('missing coverage row returns ERROR text and records nothing', async () => {
  const boxQuery = 'SELECT team, wins FROM goalie_games'
  const { deps, answers } = setup(
    { [boxQuery]: rows, [coverageSql(team)]: [] },
    fakeGuard({ ok: true, touchesBoxscores: true }),
  )
  assert.equal(await runAnswer(deps, { query: boxQuery, row: 0, column: 'wins' }), 'ERROR: no boxscore_coverage row for NJD')
  assert.deepEqual(answers, [])
})

test('failing coverage query returns ERROR text and records nothing', async () => {
  const boxQuery = 'SELECT team, wins FROM goalie_games'
  const { deps, answers } = setup(
    {
      [boxQuery]: rows,
      [coverageSql(team)]: new SqlError({ message: 'db down', sql: coverageSql(team) }),
    },
    fakeGuard({ ok: true, touchesBoxscores: true }),
  )
  assert.equal(await runAnswer(deps, { query: boxQuery, row: 0, column: 'wins' }), 'ERROR: coverage query failed: db down')
  assert.deepEqual(answers, [])
})

test('makeAnswerTool builds a tool', () => {
  const { deps } = setup({ [query]: rows })
  assert.ok(makeAnswerTool(deps))
})
