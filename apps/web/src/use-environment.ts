import { Config, Effect } from 'effect'

const nodeEnv = Config.String('NODE_ENV').pipe(Config.withDefault(''))

/** Whether the server runs in development. Route modules call it to gate pages that exist for development only. */
export function isDevelopment(): boolean {
  return Effect.runSync(nodeEnv) === 'development'
}
