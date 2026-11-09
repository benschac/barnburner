export type Outcome = "win" | "loss" | "overtime" | "pending";
export type Venue = "home" | "away";
export type Matchup = {
  team: string;
  games: { venue: Venue; outcome: Outcome }[];
};

// Static transcription of the supplied November 8 graphic, not live NHL data.
const matchup = (team: string, marks: string): Matchup => ({
  team,
  games: marks.split(" ").map((mark) => ({
    venue: mark[0] === "H" ? "home" : "away",
    outcome: mark[1] === "W" ? "win" : mark[1] === "L" ? "loss" : "pending",
  })),
});

export const divisions = [
  {
    name: "Atlantic",
    record: "1-1-0",
    teams: [
      matchup("BOS", "A H H"),
      matchup("MTL", "H A A"),
      matchup("TBL", "H A H"),
      matchup("OTT", "HL A H"),
      matchup("FLA", "A A H"),
      matchup("BUF", "A A H"),
      matchup("TOR", "A H H"),
      matchup("DET", "AW H A"),
    ],
  },
  {
    name: "Pacific",
    record: "5-0-0",
    teams: [
      matchup("EDM", "HW A"),
      matchup("VGK", "AW H"),
      matchup("SEA", "H A"),
      matchup("ANA", "HW A"),
      matchup("CGY", "H A"),
      matchup("SJS", "H A"),
      matchup("LAK", "HW A"),
      matchup("VAN", "HW A"),
    ],
  },
  {
    name: "Metropolitan",
    record: "3-2-0",
    teams: [
      matchup("CAR", "H A H A"),
      matchup("NYR", "HW A H A"),
      matchup("WSH", "AL H A H"),
      matchup("NYI", "AL AW H H"),
      matchup("CBJ", "H A H A"),
      matchup("PIT", "A A H H"),
      matchup("PHI", "HW A A H"),
    ],
  },
  {
    name: "Central",
    record: "3-2-0",
    teams: [
      matchup("MIN", "A H"),
      matchup("DAL", "AW H"),
      matchup("COL", "HW AL"),
      matchup("NSH", "H A"),
      matchup("UTA", "HL A"),
      matchup("STL", "HW A"),
      matchup("WPG", "A H"),
      matchup("CHI", "H A"),
    ],
  },
];

export const margins = [1, -5, -2, 3, -3, 1, 5, -2, 1, 3, 2, 4, -3, 3, 1, 1, 1];
export const playoffMargins = [
  0, 0, -2, -2, -1, -1, -1, -2, -2, 0, 0, 1, 0, 0, 2, 3, 5,
];
// Filled/ring markers are read visually from the reference; no schedule API is used.
export const venues =
  "HAHHHAHAHHHAAAHHAAAHAHAHHHHHAAAHAHHHHHAHAAAAHHAHHHHAHHAAAAAAAHHHAAHAHAAAHHHAAHHAHHHH".split(
    "",
  );

export const standings = [
  { seed: "M1", team: "CAR", played: 19, points: 30 },
  { seed: "M2", team: "NJD", played: 17, points: 24 },
  { seed: "M3", team: "NYR", played: 18, points: 21 },
  { seed: "WC1", team: "OTT", played: 18, points: 23 },
  { seed: "WC2", team: "FLA", played: 17, points: 20 },
  { seed: "", team: "BUF", played: 16, points: 19 },
  { seed: "", team: "WSH", played: 15, points: 18 },
  { seed: "", team: "TOR", played: 18, points: 18 },
];

export const upcoming = [
  { day: "SUN", date: 8, venue: "@", team: "TOR", time: "7:00pm" },
  { day: "TUE", date: 10, venue: "@", team: "WPG", time: "7:00pm" },
  { day: "THU", date: 12, venue: "vs", team: "WSH", time: "7:00pm" },
  { day: "SAT", date: 14, venue: "@", team: "WSH", time: "7:00pm" },
  { day: "WED", date: 18, venue: "vs", team: "MTL", time: "7:30pm" },
];
export const recent = [
  { team: "NYI", outcome: "win", score: "5-4", extra: "OT" },
  { team: "STL", outcome: "win", score: "5-4", extra: "OT" },
  { team: "EDM", outcome: "win", score: "4-3", extra: "SO" },
  { team: "VGK", outcome: "win", score: "5-2", extra: "" },
  { team: "COL", outcome: "loss", score: "5-2", extra: "" },
] as const;
export const leaders = [
  {
    label: "POINTS",
    name: "J. Hughes",
    portrait: "hughes",
    detail: "9 goals, 14 assists",
    value: "23",
  },
  {
    label: "SHOTS ON GOAL",
    name: "J. Hughes",
    portrait: "hughes",
    detail: "9 goals, 12.9% shooting",
    value: "70",
  },
  {
    label: "SAVE PERCENTAGE",
    name: "J. Allen",
    portrait: "allen",
    detail: "9 games, 3.20 GAA",
    value: ".881",
  },
];
