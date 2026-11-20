import * as G2 from '@antv/g2'
import * as G6 from '@antv/g6'
import * as d3 from 'd3'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import manifest from '../../../package.json' with { type: 'json' }
import { createFrame, FrameBootFailed, loadModule } from './frame.ts'

// The page script of `viz-frame.html`: it boots the runtime in `frame.ts`. Only the frame bundle loads this
// file, so a test that imports `frame.ts` for `createFrame` never touches the libraries or the document.

/** The libraries a view receives, as pinned in `apps/web/package.json`. */
const dependencies: Readonly<Record<string, string>> = manifest.dependencies
const pinned = (name: string): string => Option.getOrElse(Option.fromNullishOr(dependencies[name]), () => 'unknown')

// The frame starts the effects its window events raise here, at the entry, so `frame.ts` never owns the runtime.
const forkFrameEffect = (effect: Effect.Effect<void>): void => { Effect.runFork(effect) }

const boot = Effect.gen(function* () {
  const root = document.getElementById('root')
  if (root === null) return yield* new FrameBootFailed({ message: 'viz-frame.html has no #root element.' })
  createFrame({
    win: window,
    root,
    variables: document.documentElement.style,
    libs: { G2, G6, d3, THREE },
    versions: { g2: pinned('@antv/g2'), g6: pinned('@antv/g6'), d3: pinned('d3'), three: pinned('three') },
    load: loadModule,
    now: () => performance.now(),
    run: forkFrameEffect,
  }).listen()
})

// A frame that cannot boot never posts `Ready`, so the host's timeout replaces it; the log says why.
Effect.runFork(boot.pipe(Effect.catchCause((cause) => Effect.logError(cause))))
