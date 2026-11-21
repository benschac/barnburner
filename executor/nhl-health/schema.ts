import { array, number, object, string, type Infer } from "apps";

export const Sources = [
  {
    id: "standings",
    name: "League standings",
    url: "https://api-web.nhle.com/v1/standings/now",
  },
  {
    id: "scores",
    name: "Daily scores",
    url: "https://api-web.nhle.com/v1/score/now",
  },
] as const;

export const Check = object({
  id: string(),
  source: string(),
  checkedAt: number(),
  status: string(),
  sourceDate: string(),
  records: number(),
  httpStatus: number(),
  detail: string(),
});
export const Checks = array(Check);
export type CheckRow = Infer<typeof Check>;
export type Source = (typeof Sources)[number];

export const Standings = object({
  standings: array(
    object({
      date: string().optional(),
      teamAbbrev: object({ default: string() }),
      gamesPlayed: number(),
      points: number(),
    })
  ),
});
export const Scores = object({
  currentDate: string().optional(),
  games: array(object({ id: number(), gameState: string() })),
});
