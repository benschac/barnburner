import { resolve } from 'node:path'
import { Config, Effect } from 'effect'
import { logError } from '../../../lib/logger.mjs'
import { ask } from '../src/ask.ts'
import { openDb } from '../src/db.ts'
import { Llm } from '../src/llm.ts'
import { toPrettyJson } from '../src/json.ts'

const usage = 'Usage: bun run ask "question" --team NJD [--data-dir PATH]'
const args = process.argv.slice(2)
const question = args[0]
let team: string | undefined
let dataDir = await Effect.runPromise(Config.withDefault(Config.String('ANALYST_DATA_DIR'), resolve(import.meta.dirname, '../../../data')))
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
  process.stdout.write(`${usage}\n`)
} else if (!valid || !team || !/^[A-Z]{3}$/.test(team)) {
  logError(usage)
  process.exitCode = 1
} else {
  await Effect.runPromise(
    Effect.scoped(Effect.gen(function* () {
      const db = yield* openDb({ dataDir })
      return yield* ask({ question: question!, team, db })
    })).pipe(Effect.provide(Llm.layer())),
  ).then((result) => {
    process.stdout.write(`${toPrettyJson(result)}\n`)
    if (result.outcome._tag === 'Crashed') process.exitCode = 1
  }, (error: unknown) => {
    logError(String(error))
    process.exitCode = 1
  })
}
