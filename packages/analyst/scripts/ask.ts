import { resolve } from 'node:path'
import { Effect } from 'effect'
import { ask } from '../src/ask.ts'
import { openDb } from '../src/db.ts'
import { Llm } from '../src/llm.ts'
import { toPrettyJson } from '../src/json.ts'

const usage = 'Usage: bun run ask "question" --team NJD [--data-dir PATH]'
const args = process.argv.slice(2)
const question = args[0]
let team: string | undefined
let dataDir = process.env.ANALYST_DATA_DIR ?? resolve(import.meta.dirname, '../../../data')
let valid = Boolean(question && !question.startsWith('--'))
for (let index = 1; index < args.length; index += 2) {
  const name = args[index]
  const value = args[index + 1]
  if (!value || value.startsWith('--')) { valid = false; break }
  if (name === '--team' && team === undefined) team = value
  else if (name === '--data-dir') dataDir = resolve(value)
  else valid = false
}
if (args.length === 1 && question === '--help') {
  console.log(usage)
} else if (!valid || !team || !/^[A-Z]{3}$/.test(team)) {
  console.error(usage)
  process.exitCode = 1
} else {
  await Effect.runPromise(
    Effect.scoped(Effect.gen(function* () {
      const db = yield* openDb({ dataDir })
      return yield* ask({ question: question!, team, db })
    })).pipe(Effect.provide(Llm.layer())),
  ).then((result) => {
    console.log(toPrettyJson(result))
    if (result.outcome._tag === 'Crashed') process.exitCode = 1
  }, (error: unknown) => {
    console.error(String(error))
    process.exitCode = 1
  })
}
