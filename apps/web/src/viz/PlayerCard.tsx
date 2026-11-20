import { View, styled } from "tamagui";

import { Copy } from "../components/team-poster/primitives";

export type PlayerCardProps = {
  name: string;
  position: string;
  // Both are 8-digit season IDs: 20152016 is 2015–16.
  firstSeason: number;
  lastSeason: number;
  games: number;
  emphasis?: boolean;
};

// Season IDs in, a span out: 20152016 and 20252026 read as "2015–26".
export function seasonSpan(firstSeason: number, lastSeason: number): string {
  const startYear = Math.floor(firstSeason / 10000);
  const endYear = lastSeason % 10000;
  return `${startYear}–${String(endYear % 100).padStart(2, "0")}`;
}

const Frame = styled(View, {
  bg: "surface",
  borderWidth: 1,
  rounded: "sm",
  p: "2",
  gap: "0.5",
  minW: "card",
});

export function PlayerCard({
  name,
  position,
  firstSeason,
  lastSeason,
  games,
  emphasis = false,
}: PlayerCardProps) {
  return (
    <Frame
      borderColor={emphasis ? "gold" : "rule"}
      borderWidth={emphasis ? 2 : 1}
    >
      <Copy fontWeight="700" color={emphasis ? "gold" : "color"}>
        {name}
      </Copy>
      <Copy fontSize="caption" lineHeight="caption" color="muted">
        {`${position} · ${seasonSpan(firstSeason, lastSeason)}`}
      </Copy>
      <Copy fontSize="caption" lineHeight="caption" color="muted">
        {`${games} GP`}
      </Copy>
    </Frame>
  );
}
