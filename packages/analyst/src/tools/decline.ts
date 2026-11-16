import { tool, jsonSchema } from 'ai'

export interface DeclineDeps {
  readonly onDecline: (reason: string) => void
}

export interface DeclineInput {
  readonly reason: string
}

// Runtime check of model-supplied arguments. Wrong types are reported, never coerced.
export const checkDeclineInput = (raw: unknown): { ok: true; input: DeclineInput } | { ok: false; reason: string } => {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'input must be an object' }
  const { reason } = raw as Record<string, unknown>
  if (typeof reason !== 'string' || reason.trim() === '') return { ok: false, reason: 'reason must be a non-empty string' }
  return { ok: true, input: { reason: reason.trim() } }
}

// Returns "ok", or "ERROR: <reason>" when the arguments are invalid.
export const runDecline = (deps: DeclineDeps, raw: unknown): string => {
  const checked = checkDeclineInput(raw)
  if (!checked.ok) return `ERROR: ${checked.reason}`
  deps.onDecline(checked.input.reason)
  return 'ok'
}

export const makeDeclineTool = (deps: DeclineDeps) =>
  tool({
    description:
      'Decline the question because it is out of scope or cannot be answered from the available data. Give a short reason.',
    inputSchema: jsonSchema<DeclineInput>(
      {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the question cannot be answered.' },
        },
        required: ['reason'],
        additionalProperties: false,
      },
      {
        validate: (value) => {
          const checked = checkDeclineInput(value)
          return checked.ok ? { success: true, value: checked.input } : { success: false, error: new Error(checked.reason) }
        },
      },
    ),
    execute: (input) => runDecline(deps, input),
  })
