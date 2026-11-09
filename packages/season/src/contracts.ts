import { Schema } from 'effect'
import { Rpc, RpcGroup } from 'effect/rpc'
import { TeamData } from './team-season.ts'

export class SnapshotLoadError extends Schema.TaggedError<SnapshotLoadError>()('SnapshotLoadError', {
  message: Schema.String,
}) {}

export const TeamRpcs = RpcGroup.make(
  Rpc.make('GetTeamData', {
    payload: Schema.Struct({}),
    success: TeamData,
    error: SnapshotLoadError,
  }),
)
