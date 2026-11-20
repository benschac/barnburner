import { useState } from "react";
import { Dialog, View } from "tamagui";

import { useBoxscore } from "../../use-boxscore";
import { BoxscoreSheet } from "./BoxscoreSheet";
import { Copy, Label, Row } from "./primitives";

function Body({ gameId }: { gameId: number }) {
  const { status, boxscore, retry } = useBoxscore(gameId);
  if (status === "loading")
    return (
      <Copy role="status" color="muted" text="center" py="8">
        Loading box score…
      </Copy>
    );
  if (status === "unavailable")
    return (
      <Copy role="status" color="muted" text="center" py="8">
        The box score for this game is not available yet.
      </Copy>
    );
  if (!boxscore)
    return (
      <View role="alert" gap="3" items="center" py="8">
        <Copy color="muted">The box score could not be loaded.</Copy>
        <View
          render="button"
          minH="10"
          px="4"
          items="center"
          justify="center"
          bg="surface"
          rounded="sm"
          borderWidth={1}
          cursor="pointer"
          borderColor="rule focus-visible:gold"
          onPress={retry}
        >
          <Copy fontWeight="600">Retry</Copy>
        </View>
      </View>
    );
  return <BoxscoreSheet boxscore={boxscore} />;
}

export function GameBoxscoreDialog({
  gameId,
  opponent,
  score,
}: {
  gameId: number;
  opponent?: string;
  score?: string;
}) {
  const [open, setOpen] = useState(false);

  const label =
    opponent === undefined
      ? `Box score, game ${gameId}${score === undefined ? "" : `, ${score}`}`
      : `Box score, game against ${opponent}${score === undefined ? "" : `, ${score}`}`;

  const context =
    opponent === undefined
      ? score === undefined
        ? ""
        : `${score} · `
      : `vs ${opponent}${score === undefined ? "" : `, ${score}`} · `;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        minH="8"
        px="1"
        items="center"
        justify="center"
        bg="transparent hover:surface"
        rounded="sm"
        borderWidth={1}
        cursor="pointer"
        borderColor="transparent focus-visible:gold"
        aria-label={label}
      >
        <Label render="span">BOX SCORE</Label>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay bg="background" opacity={0.9} />
        <Dialog.Content
          w="100%"
          maxW="chart"
          maxH="100vh"
          overflow="auto"
          bg="background"
          p="4 sm:8"
          borderWidth={1}
          borderColor="gold"
          rounded="md"
        >
          <Row justify="space-between" gap="3">
            <Dialog.Title
              m="0"
              fontFamily="body"
              fontSize="caption"
              lineHeight="caption"
              letterSpacing={1}
              fontWeight="600"
              color="gold"
            >
              THE GAME SHEET
            </Dialog.Title>
            <Dialog.Close
              render="button"
              minH="10"
              px="3"
              py="2"
              items="center"
              justify="center"
              bg="transparent hover:surface"
              rounded="sm"
              borderWidth={1}
              cursor="pointer"
              borderColor="rule focus-visible:gold"
              aria-label="Close box score"
            >
              <Copy>Close ×</Copy>
            </Dialog.Close>
          </Row>
          <Dialog.Description
            render={<Copy color="muted" fontSize="caption" />}
          >
            {context}The final, every point scorer, and both creases.
          </Dialog.Description>
          {open && <Body key={gameId} gameId={gameId} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
