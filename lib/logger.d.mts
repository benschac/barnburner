import type { Layer } from 'effect/Layer'

export const loggerLayer: Layer<never>
export function logInfo(...messages: unknown[]): void
export function logWarning(...messages: unknown[]): void
export function logError(...messages: unknown[]): void
