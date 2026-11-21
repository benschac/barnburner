"use client";

import { FrameReport, Render } from "@nhl-reddit-stats/viz";
import type { Tables, VizTheme } from "@nhl-reddit-stats/viz";
import { createEffectActor } from "@xstate/effect";
import { Effect, Match, Option, Schema, Scope } from "effect";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "tamagui";
import type { SnapshotFrom } from "xstate";

import { useScopedProgram } from "../use-scoped-program.ts";
import { frameMachine } from "../viz/frame/frame-machine.ts";
import { useVizTheme } from "../viz/theme.ts";

// The host of the sandboxed visualization frame (plan section C-viz, decision D17). The frame is an untrusted
// iframe: every message from it is checked against its window and decoded, and `Rendered` and `Failed` only
// drive what this island shows, because a view can forge them.

const FRAME_URL = "/viz-frame/viz-frame.html";
const LIMIT_MS = 10_000;
const MAX_TIMEOUTS = 3;

type FrameSnapshot = SnapshotFrom<typeof frameMachine>;

type FrameProps = {
  code: string;
  tables: Tables;
  theme: VizTheme;
  onTimedOut: () => void;
  onReport?: ((report: FrameReport) => void) | undefined;
  onRender?: ((id: string) => void) | undefined;
};

type Latest = Pick<
  FrameProps,
  "code" | "tables" | "theme" | "onTimedOut" | "onReport" | "onRender"
>;

const idle = (): void => undefined;

// One iframe, one machine, one piece of code. A redraw of the same code (a new theme) reuses the frame.
function Frame(props: FrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef<Latest>(props);
  const [snapshot, setSnapshot] = useState<FrameSnapshot | null>(null);
  const draw = useRef<(tables: Tables, theme: VizTheme) => void>(idle);

  useScopedProgram(() => {
    let count = 0;
    return Effect.gen(function* () {
      const scope = yield* Scope.Scope;
      const actor = yield* createEffectActor(frameMachine, {
        input: { limitMs: LIMIT_MS },
      });
      // The machine decides when a draw may start: only the first Ready moves it to `ready`, and a repeated Ready cannot restart a render.
      draw.current = (tables, theme) => {
        const target = frame.current?.contentWindow;
        const id = `render-${count + 1}`;
        if (!target || !actor.getSnapshot().can({ type: "Render", id })) return;
        count += 1;
        actor.send({ type: "Render", id });
        const { code } = latest.current;
        latest.current.onRender?.(id);
        target.postMessage(Render.make({ id, code, tables, theme }), "*");
      };
      actor.subscribe((next) => {
        setSnapshot(next);
        if (next.matches("timedOut")) latest.current.onTimedOut();
        else if (next.matches("ready"))
          draw.current(latest.current.tables, latest.current.theme);
      });
      const onMessage = (event: MessageEvent): void => {
        // The frame has an opaque origin, so its window is the only thing that identifies it.
        if (event.source !== frame.current?.contentWindow) return;
        Option.match(Schema.decodeUnknownOption(FrameReport)(event.data), {
          onNone: () => undefined,
          onSome: (report) => {
            latest.current.onReport?.(report);
            Match.valueTags(report, {
              Ready: () => {
                actor.send({ type: "Ready" });
              },
              Rendered: ({ id }) => {
                actor.send({ type: "Rendered", id });
              },
              Failed: ({ id, message }) => {
                actor.send({ type: "Failed", id, message });
              },
              FrameRate: () => undefined,
            });
          },
        });
      };
      window.addEventListener("message", onMessage);
      yield* Scope.addFinalizer(
        scope,
        Effect.sync(() => {
          window.removeEventListener("message", onMessage);
          draw.current = idle;
        })
      );
      return yield* Effect.never;
    }).pipe(Effect.scoped);
  });

  useEffect(() => {
    latest.current = props;
  });

  // The same code with new tables or a new theme: redraw in this frame.
  useEffect(() => {
    draw.current(props.tables, props.theme);
  }, [props.tables, props.theme]);

  return (
    <View gap="2">
      <View h="seasonChart" w="100%">
        <iframe
          ref={frame}
          title="Visualization"
          src={FRAME_URL}
          sandbox="allow-scripts"
          width="100%"
          height="100%"
        />
      </View>
      {snapshot?.matches("failed") ? (
        <Text fontFamily="body" color="color">
          {`Failed: ${snapshot.context.message ?? ""}`}
        </Text>
      ) : null}
    </View>
  );
}

export type VizFrameIslandProps = {
  code: string;
  tables: Tables;
  /** Every valid report the frame posts, for a page that wants to show them. */
  onReport?: ((report: FrameReport) => void) | undefined;
  /** Called with the id of each render the island sends, so a page can tell which reports are for it. */
  onRender?: ((id: string) => void) | undefined;
  /** A new value starts a fresh frame and a fresh timeout budget, even for unchanged code, as an explicit Run does. */
  attempt?: number;
};

export function VizFrameIsland({
  code,
  tables,
  onReport,
  onRender,
  attempt = 0,
}: VizFrameIslandProps) {
  const theme = useVizTheme();
  // Different code goes to a fresh frame, because the frame cannot tell which view an uncaught error came from.
  const [slot, setSlot] = useState({ code, attempt, frame: 0, timeouts: 0 });
  if (slot.code !== code || slot.attempt !== attempt)
    setSlot({ code, attempt, frame: slot.frame + 1, timeouts: 0 });
  if (slot.timeouts >= MAX_TIMEOUTS)
    return (
      <Text fontFamily="body" color="color">
        The view did not answer in time.
      </Text>
    );
  return (
    <Frame
      key={slot.frame}
      code={code}
      tables={tables}
      theme={theme}
      onReport={onReport}
      onRender={onRender}
      onTimedOut={() => {
        setSlot((current) => ({
          code: current.code,
          attempt: current.attempt,
          frame: current.frame + 1,
          timeouts: current.timeouts + 1,
        }));
      }}
    />
  );
}

export default VizFrameIsland;
