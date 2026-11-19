import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Logger from 'effect/Logger'

// Keep stdout available for command results, including JSON and interactive reports.
const stderrLogger = Logger.withConsoleError(Logger.formatLogFmt)
export const loggerLayer = Logger.layer([stderrLogger])
const runLog = Effect.runSyncWith(Context.make(Logger.CurrentLoggers, new Set([stderrLogger])))

export const logInfo = (...messages) => runLog(Effect.logInfo(...messages))
export const logWarning = (...messages) => runLog(Effect.logWarning(...messages))
export const logError = (...messages) => runLog(Effect.logError(...messages))
