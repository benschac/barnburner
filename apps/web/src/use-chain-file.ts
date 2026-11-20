import { Effect } from 'effect'
import { useCallback } from 'react'
import { loadChainFile } from './viz/chain-file'

/** The chain view's boundary to Effect: the file input needs a promise, so the load ends inside the returned callback. */
export function useChainFile() {
  return useCallback((picked: File) => Effect.runPromise(Effect.result(loadChainFile(picked))), [])
}
