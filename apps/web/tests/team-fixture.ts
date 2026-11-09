import { teams, teamSeason } from '@nhl-reddit-stats/season'
import type { PosterSnapshot } from '@nhl-reddit-stats/season'
import snapshot from '../../../data/nhl-20262027.json' with { type: 'json' }
import { Schema } from 'effect'
import { SeasonSnapshot } from '@nhl-reddit-stats/season'

const season = Schema.decodeUnknownSync(SeasonSnapshot)(snapshot)

export const posterFixture: PosterSnapshot = {
  schemaVersion: 1, season: 20262027, fetchedAt: '2026-11-09T10:00:00Z',
  standings: teams.map((team) => ({
    team: team.abbrev, date: '2026-11-08',
    divisionSequence: teams.filter((entry) => entry.division === team.division).findIndex((entry) => entry.abbrev === team.abbrev) + 1,
    wildcardSequence: 0, points: teamSeason(season, team.abbrev).points, played: teamSeason(season, team.abbrev).played,
  })),
  history: [],
  clubs: teams.map((team) => ({ team: team.abbrev, specialTeams: [], leaders: [] })),
}
