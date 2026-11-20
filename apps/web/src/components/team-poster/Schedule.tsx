import { memo } from "react";
import { View, useThemeName } from "tamagui";

import type { TeamPosterData } from "../../stats";
import { teamHref, teamLogo } from "../../team-season.ts";
import { GameBoxscoreDialog } from "./GameBoxscore";
import { Copy, Score, Row, List, Logo, RuledHeading } from "./primitives";

const outcomeColors = {
  win: "win",
  loss: "loss",
  overtime: "gold",
  pending: "pending",
} as const;

// Ragged right edge, as if the ticket was torn from a roll. It clips only the
// background layer so the link's focus ring stays visible.
const tornEdge =
  "polygon(0 0, calc(100% - 4px) 0, 100% 7%, calc(100% - 3px) 15%, 100% 24%, calc(100% - 6px) 33%, calc(100% - 1px) 42%, calc(100% - 4px) 51%, 100% 60%, calc(100% - 5px) 70%, calc(100% - 1px) 79%, calc(100% - 4px) 89%, calc(100% - 2px) 100%, 0 100%)";

// Punched notches at the top and bottom of the stub's tear line. The stub-side
// quarter carries the gold outline; the body-side quarter is a plain cut-out.
const TicketPerforation = () => (
  <View h="card" w="4" aria-hidden>
    <Row>
      <View
        w="2"
        h="2"
        bg="background"
        borderLeftWidth={2}
        borderBottomWidth={2}
        borderColor="gold"
        borderBottomLeftRadius="full"
      />
      <View w="2" h="2" bg="background" borderBottomRightRadius="full" />
    </Row>
    <View
      flex={1}
      self="center"
      borderWidth={0}
      borderLeftWidth={2}
      borderColor="gold"
      borderStyle="dashed"
    />
    <Row>
      <View
        w="2"
        h="2"
        bg="background"
        borderLeftWidth={2}
        borderTopWidth={2}
        borderColor="gold"
        borderTopLeftRadius="full"
      />
      <View w="2" h="2" bg="background" borderTopRightRadius="full" />
    </Row>
  </View>
);

export const Schedule = memo(function Schedule({
  data,
  onPrefetchTeam,
}: {
  data: TeamPosterData;
  onPrefetchTeam: (team: string) => void;
}) {
  const { upcoming, recent } = data;
  const theme = useThemeName();
  return (
    <View>
      <View render="section" aria-labelledby="next-heading">
        <RuledHeading
          id="next-heading"
          display="flex"
          flexDirection="row"
          justify="space-between"
          items="baseline"
        >
          Next 5
          <Copy
            fontSize="caption"
            lineHeight="caption"
            letterSpacing={1}
            color="muted"
            fontWeight="500"
          >
            EASTERN TIME
          </Copy>
        </RuledHeading>
        {upcoming.length === 0 && (
          <Copy color="muted">No remaining games.</Copy>
        )}
        <List render="ol" gap="2">
          {upcoming.map((game) => (
            <Row render="li" key={game.id} h="card" position="relative">
              <View
                position="absolute"
                l="0"
                t="0"
                w="100%"
                h="card"
                bg="surface"
                rounded="md"
                clipPath={tornEdge}
              />
              <Row
                render={<a href={teamHref(game.team)} />}
                position="relative"
                w="100%"
                h="card"
                textDecorationLine="none"
                aria-label={`${game.day} ${game.date}, ${data.team.name} ${game.venue === "vs" ? "home against" : "away at"} ${game.team}, ${game.time} Eastern time`}
                onMouseEnter={() => {
                  onPrefetchTeam(game.team);
                }}
                onFocus={() => {
                  onPrefetchTeam(game.team);
                }}
              >
                <Row
                  h="card"
                  w="24"
                  borderWidth={2}
                  borderRightWidth={0}
                  borderColor="gold"
                  borderTopLeftRadius="md"
                  borderBottomLeftRadius="md"
                >
                  <View flex={1} items="center">
                    <Copy
                      fontSize="caption"
                      lineHeight="caption"
                      fontWeight="700"
                      letterSpacing={1}
                      color="gold"
                    >
                      {game.day}
                    </Copy>
                    <Score fontSize="score" lineHeight="score">
                      {game.date}
                    </Score>
                  </View>
                </Row>
                <TicketPerforation />
                <View
                  flex={1}
                  minW="0"
                  h="card"
                  py="1"
                  pl="1"
                  pr="3"
                  borderTopWidth={1}
                  borderBottomWidth={1}
                  borderColor="gold"
                >
                  <Copy
                    text="center"
                    fontSize="caption"
                    lineHeight="caption"
                    fontWeight="700"
                    letterSpacing={1}
                    bg="brand"
                    color="loss-ink dark:bright"
                  >
                    {data.team.abbrev} {game.venue.toUpperCase()} {game.team}
                  </Copy>
                  <Row flex={1} gap="1" justify="space-between">
                    <Logo
                      src={teamLogo(data.team.abbrev, theme)}
                      alt=""
                      w="10"
                      h="10"
                    />
                    <View flex={1} minW="0" items="center">
                      <Copy
                        fontSize="detail"
                        lineHeight="detail"
                        fontWeight="600"
                        text="center"
                      >
                        {game.time}
                      </Copy>
                      <Copy
                        fontSize="caption"
                        lineHeight="caption"
                        fontWeight="700"
                        letterSpacing={1}
                        color="gold"
                      >
                        {game.venue === "vs" ? "HOME" : "AWAY"}
                      </Copy>
                    </View>
                    <Logo
                      src={teamLogo(game.team, theme)}
                      alt=""
                      w="10"
                      h="10"
                    />
                  </Row>
                </View>
              </Row>
            </Row>
          ))}
        </List>
      </View>
      <View render="section" mt="4" aria-labelledby="last-heading">
        <RuledHeading id="last-heading" mb="2">
          Last 5
        </RuledHeading>
        {recent.length === 0 && <Copy color="muted">No final games yet.</Copy>}
        <List render="ol">
          {recent.map((game) => (
            <Row render="li" h="12" key={game.id}>
              <Row
                render={<a href={teamHref(game.team)} />}
                flex={1}
                h="12"
                gap="3"
                textDecorationLine="none"
                onMouseEnter={() => {
                  onPrefetchTeam(game.team);
                }}
                onFocus={() => {
                  onPrefetchTeam(game.team);
                }}
              >
                <Logo
                  src={
                    game.team === "WSH"
                      ? "/assets/teams/WSH.svg"
                      : teamLogo(game.team, theme)
                  }
                  alt={game.team}
                  w="16"
                  h="10"
                  mr="px"
                  scale={1.07}
                />
                <Copy
                  w="10"
                  h="10"
                  display="flex"
                  items="center"
                  justify="center"
                  rounded="sm"
                  fontFamily="result"
                  fontSize="title"
                  lineHeight="label"
                  bg={outcomeColors[game.outcome]}
                  color={game.outcome === "win" ? "result-ink" : "loss-ink"}
                >
                  {game.outcome === "win" ? "W" : "L"}
                </Copy>
                <Copy fontSize="title" lineHeight="title" fontWeight="500">
                  {game.score}
                </Copy>
                <Copy fontSize="body" lineHeight="caption" color="gold" ml="px">
                  {game.extra}
                </Copy>
              </Row>
              <GameBoxscoreDialog
                gameId={game.id}
                opponent={game.team}
                score={game.score}
              />
            </Row>
          ))}
        </List>
      </View>
    </View>
  );
});
