import { tool, jsonSchema } from 'ai'

export interface DeclineDeps {
  readonly onDecline: (reason: string) => void
}

export interface DeclineInput {
  readonly reason: string
}

// Returns "ok", or "ERROR: <reason>" when the reason is blank.
export const runDecline = (deps: DeclineDeps, input: DeclineInput): string => {
  const reason = input.reason.trim()
  if (reason === '') return 'ERROR: reason is required'
  deps.onDecline(reason)
  return 'ok'
}

export const makeDeclineTool = (deps: DeclineDeps) =>
  tool({
    description:
      'Decline the question because it is out of scope or cannot be answered from the available data. Give a short reason.',
    inputSchema: jsonSchema<DeclineInput>({
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why the question cannot be answered.' },
      },
      required: ['reason'],
      additionalProperties: false,
    }),
    execute: (input) => runDecline(deps, input),
  })
