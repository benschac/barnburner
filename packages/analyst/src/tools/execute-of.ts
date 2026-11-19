// Every tool factory in this package supplies `execute`, but the AI SDK types it as optional.
export const executeOf = <F>(execute: F | undefined): F => {
  // defect: each tool factory passes `execute` to `tool()`
  if (execute === undefined) throw new Error('Tool has no execute function')
  return execute
}
