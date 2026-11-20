import {
  Failed,
  FrameRate,
  HostMessage,
  Ready,
  Rendered,
} from "@nhl-reddit-stats/viz";
import type {
  Dispose,
  FrameReport,
  Render,
  RenderView,
  ViewContext,
  VizTheme,
} from "@nhl-reddit-stats/viz";
import { Effect, Match, Option, Predicate, Schema } from "effect";

import { cssVariables } from "../theme-css.ts";

// The runtime of the sandboxed visualization frame (plan section C-viz, decision D17). This file is the library:
// `main.ts` is the page script of `viz-frame.html`, and it boots this runtime. The host posts `Render` and `Dispose`; the frame posts `Ready`, `Rendered`,
// `Failed`, and `FrameRate`. Nothing here is a security boundary: the frame is an iframe with an opaque
// origin and a CSP (FS3), and model-written code can post any message to the host. The host treats every
// frame message as untrusted and validates it.
//
// One limit, stated rather than fixed: a window-level `error` or `unhandledrejection` cannot be traced to
// the view that caused it. The frame reports it against the view that is active when it fires, so a
// rejection from a retired view's leftover work (a timer, a promise, an animation frame it never cancelled)
// is reported against the view that replaced it. What follows for the host: a `Render` with different
// code goes to a fresh frame, and only a redraw of the same code (a theme change) reuses one.

/** A view that could not run, or whose cleanup threw. `message` goes to the host in `Failed`. */
export class ViewFailed extends Schema.TaggedError<
  ViewFailed,
  { readonly brand: unique symbol }
>()("ViewFailed", {
  message: Schema.String,
}) {}

/** The frame could not start: the page has no root element. */
export class FrameBootFailed extends Schema.TaggedError<
  FrameBootFailed,
  { readonly brand: unique symbol }
>()("FrameBootFailed", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

/** The part of a `MessageEvent` the frame reads. */
export type FrameMessageEvent = {
  readonly source: unknown;
  readonly data: unknown;
};
/** The part of an `ErrorEvent` the frame reads. `error` is null when the browser hides the cause. */
export type FrameErrorEvent = {
  readonly message?: unknown;
  readonly error?: unknown;
};
/** The part of a `PromiseRejectionEvent` the frame reads. */
export type FrameRejectionEvent = { readonly reason?: unknown };

export type FrameEvents = {
  message: FrameMessageEvent;
  error: FrameErrorEvent;
  unhandledrejection: FrameRejectionEvent;
};

/** The part of `window` the frame uses, so a test can supply a fake. */
export type FrameWindow = {
  readonly parent: {
    postMessage(message: FrameReport, targetOrigin: string): void;
  };
  addEventListener<K extends keyof FrameEvents>(
    type: K,
    listener: (event: FrameEvents[K]) => void
  ): void;
  removeEventListener<K extends keyof FrameEvents>(
    type: K,
    listener: (event: FrameEvents[K]) => void
  ): void;
  requestAnimationFrame(callback: (time: number) => void): number;
  cancelAnimationFrame(handle: number): void;
};

/** What a dynamic `import()` yields. The code is the model's, so `default` is checked before the frame calls it. */
export type ModuleNamespace = { readonly default?: unknown };

export type FrameDeps = {
  readonly win: FrameWindow;
  /** The element a view draws in. The frame clears it when a view ends. */
  readonly root: HTMLElement;
  /** Where the theme's CSS variables are set, normally `document.documentElement.style`. */
  readonly variables: { setProperty(name: string, value: string): void };
  readonly libs: ViewContext["libs"];
  readonly versions: Readonly<Record<string, string>>;
  /** Turns the posted code into its module namespace. */
  readonly load: (code: string) => Promise<ModuleNamespace>;
  /** Runs an effect the frame starts from a window event. The entry file (`main.ts`) supplies it, so the frame never owns the runtime. */
  readonly run: (effect: Effect.Effect<void>) => void;
  /** A millisecond clock on the same timeline as the `requestAnimationFrame` timestamps. */
  readonly now: () => number;
};

/**
 * The CSS variables a theme sets: `--viz-<kebab-name>` for each colour, `--viz-series-<n>`, `--viz-font-body`,
 * `--viz-font-score`, and the `color-scheme` property.
 */
export const themeVariables = (
  theme: VizTheme
): readonly (readonly [name: string, value: string])[] => [
  ["color-scheme", theme.mode],
  ...Object.entries(cssVariables(theme)),
];

const describe = (cause: unknown): string =>
  cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);

const viewFailed = (prefix: string) => (cause: unknown) =>
  new ViewFailed({ message: `${prefix}${describe(cause)}` });

/**
 * Runs posted code as an ES module and resolves to its namespace. The code becomes a `blob:` URL that a
 * dynamic `import()` loads. The frame's policy allows `blob:` scripts and has no `unsafe-eval`, so
 * `eval` and `new Function` are blocked and this is the one route that works under it. A blob module has
 * no base URL, so the module imports nothing, as the view contract says.
 */
export const loadModule = (code: string): Promise<ModuleNamespace> => {
  const url = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" })
  );
  return import(url).finally(() => {
    URL.revokeObjectURL(url);
  });
};

type LoadedModule = {
  readonly code: string;
  readonly namespace: ModuleNamespace;
};

type ActiveView = {
  readonly id: string;
  cleanup: (() => void) | null;
  frame: number | null;
};

// A view's default export is a function by contract; the module is the model's, so the frame checks it.
const isRenderView = (value: unknown): value is RenderView =>
  Predicate.isFunction(value);

const roundTenth = (value: number): number => Math.round(value * 10) / 10;

/**
 * The frame's message handling. `listen` listens for the parent's messages and posts `Ready`; the function
 * it returns stops listening and ends the running view. One view runs at a time: a new `Render` ends the
 * one before it.
 */
export const createFrame = (deps: FrameDeps) => {
  const { win, root } = deps;
  let active: ActiveView | null = null;
  // The last module loaded, kept by its code. Revoking a blob URL does not evict the evaluated module, so
  // every distinct import stays in memory; a redraw with identical code reuses this one instead of adding another.
  let loaded: LoadedModule | null = null;

  const post = (message: FrameReport): void => {
    // The frame cannot know the host's origin, and a report holds nothing the host did not send.
    win.parent.postMessage(message, "*");
  };

  const fail = (id: string, error: ViewFailed): void => {
    post(Failed.make({ id, message: error.message }));
  };

  /** Ends `view`: stops its frame loop, calls its cleanup, and clears the root. A cleanup that throws is reported. */
  const retire = (view: ActiveView): Effect.Effect<void> => {
    if (active === view) active = null;
    if (view.frame !== null) win.cancelAnimationFrame(view.frame);
    view.frame = null;
    const cleanup = view.cleanup;
    view.cleanup = null;
    return (
      cleanup === null
        ? Effect.void
        : Effect.try({ try: cleanup, catch: viewFailed("The cleanup threw. ") })
    ).pipe(
      Effect.catchTag("ViewFailed", (error) =>
        Effect.sync(() => {
          fail(view.id, error);
        })
      ),
      Effect.ensuring(
        Effect.sync(() => {
          root.replaceChildren();
        })
      )
    );
  };

  /**
   * Counts frames of the running view. `Rendered` is posted on the first frame, the second or later, at which
   * the root holds a node: two frames show the browser could paint, and a node shows the view drew. Until
   * then nothing is posted, and the host's time limit decides. Each second after that yields a rate.
   */
  const watch = (view: ActiveView, startedAt: number): void => {
    let ticks = 0;
    let windowStart = 0;
    let frames = 0;
    let rendered = false;
    const tick = (time: number): void => {
      if (active !== view) return;
      ticks += 1;
      if (ticks === 1) windowStart = time;
      else frames += 1;
      // The first callback runs before the first paint, so the second runs after it.
      if (!rendered && ticks >= 2 && root.childNodes.length > 0) {
        rendered = true;
        windowStart = time;
        frames = 0;
        post(
          Rendered.make({
            id: view.id,
            ms: Math.max(0, deps.now() - startedAt),
          })
        );
      }
      if (rendered && frames > 0 && time - windowStart >= 1000) {
        post(
          FrameRate.make({
            id: view.id,
            fps: roundTenth((frames * 1000) / (time - windowStart)),
          })
        );
        windowStart = time;
        frames = 0;
      }
      view.frame = win.requestAnimationFrame(tick);
    };
    view.frame = win.requestAnimationFrame(tick);
  };

  const render = (message: typeof Render.Type) =>
    Effect.gen(function* () {
      if (active !== null) yield* retire(active);
      const view: ActiveView = { id: message.id, cleanup: null, frame: null };
      active = view;
      const startedAt = deps.now();
      yield* Effect.sync(() => {
        themeVariables(message.theme).forEach(([name, value]) => {
          deps.variables.setProperty(name, value);
        });
      });
      const run = Effect.gen(function* () {
        const namespace =
          loaded !== null && loaded.code === message.code
            ? loaded.namespace
            : yield* Effect.tryPromise({
                try: () => deps.load(message.code),
                catch: viewFailed("The module could not be loaded. "),
              });
        loaded = { code: message.code, namespace };
        // A `Dispose` or a newer `Render` arrived while the module loaded.
        if (active !== view) return;
        // The module is the model's, so its shape is checked here, not trusted from `ViewModule`.
        const entry = namespace.default;
        if (!isRenderView(entry))
          return yield* new ViewFailed({
            message: "The module has no default export function.",
          });
        const cleanup = yield* Effect.try({
          try: () =>
            entry({
              root,
              tables: message.tables,
              theme: message.theme,
              size: { width: root.clientWidth, height: root.clientHeight },
              libs: deps.libs,
            }),
          catch: viewFailed("The view threw. "),
        });
        if (!Predicate.isFunction(cleanup))
          return yield* new ViewFailed({
            message: "The view did not return a cleanup function.",
          });
        const end = (): void => {
          cleanup();
        };
        // A callback inside `entry` can raise a window error, which retires the view before its cleanup exists.
        // Then the cleanup runs at once, the root is cleared of whatever `entry` drew, and nothing is watched.
        if (active !== view) {
          yield* Effect.try({
            try: end,
            catch: viewFailed("The cleanup threw. "),
          }).pipe(
            Effect.catchTag("ViewFailed", (error) =>
              Effect.sync(() => {
                fail(view.id, error);
              })
            )
          );
          if (active === null) root.replaceChildren();
          return;
        }
        view.cleanup = end;
        watch(view, startedAt);
      });
      yield* run.pipe(
        Effect.catchTag("ViewFailed", (error) =>
          Effect.gen(function* () {
            if (active !== view) return;
            yield* retire(view);
            fail(view.id, error);
          })
        )
      );
    });

  const dispose = (message: typeof Dispose.Type) =>
    active !== null && active.id === message.id ? retire(active) : Effect.void;

  /**
   * A view that fails after `render()` returns (a rejected promise, an exception in an animation frame,
   * a timer, or an event handler) surfaces as a window `error` or `unhandledrejection`. While a view is
   * active the failure is its own: report it, then end the view so no `Rendered` or `FrameRate` follows.
   */
  const failActive = (text: string): void => {
    if (active === null) return;
    const view = active;
    fail(view.id, new ViewFailed({ message: text }));
    deps.run(retire(view));
  };
  const onError = (event: FrameErrorEvent): void => {
    failActive(
      event.error !== undefined && event.error !== null
        ? `The view failed. ${describe(event.error)}`
        : `The view failed. ${Predicate.isString(event.message) ? event.message : "Unknown error"}`
    );
  };
  const onRejection = (event: FrameRejectionEvent): void => {
    failActive(`The view failed. ${describe(event.reason)}`);
  };

  const onMessage = (event: FrameMessageEvent): void => {
    if (event.source !== win.parent) return;
    // Decoding validates every row of every table, so its cost grows with the data. Measured in the node
    // test environment (Node 24, effect 4.1.2) for one `Render` holding a single 500,000-row table of four
    // numeric columns: 473, 519 and 598 ms over three runs, about 1 microsecond per cell.
    Option.match(Schema.decodeUnknownOption(HostMessage)(event.data), {
      onNone: () => undefined,
      onSome: (message) => {
        deps.run(
          Match.valueTags(message, { Render: render, Dispose: dispose })
        );
      },
    });
  };

  return {
    listen: (): (() => void) => {
      win.addEventListener("message", onMessage);
      win.addEventListener("error", onError);
      win.addEventListener("unhandledrejection", onRejection);
      post(Ready.make({ versions: deps.versions }));
      return () => {
        win.removeEventListener("message", onMessage);
        win.removeEventListener("error", onError);
        win.removeEventListener("unhandledrejection", onRejection);
        if (active !== null) deps.run(retire(active));
      };
    },
  };
};
