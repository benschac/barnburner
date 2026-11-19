import { Cause, Duration, Layer, Match, Option, Schema } from 'effect'
import { AsyncResult, Atom, AtomRpc } from 'effect/reactivity'
import { FetchHttpClient } from 'effect/http'
import { RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc'
import {
  FindPathInput, GetFarthestInput, GetFinalsCoverageInput, GetLinkInput, GetOpponentsInput, GetOpposedGamesInput,
  GetPlayerInput, GetRosterInput, GetSharedGamesInput, HistoryRpcs, HistoryUnavailable, SearchPlayersInput,
} from '@nhl-reddit-stats/history/rpc'

type Payload<S extends Schema.Top> = S['Type']
type Filter = Payload<typeof GetLinkInput>['filter']

/** One snapshot's answers never change while the page lives, so an unused result may be dropped after this long. */
const timeToLive = Duration.minutes(5)

const fetchProtocol = RpcClient.layerProtocolHttp({ url: '/api/history' }).pipe(
  Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
)

/**
 * The transport the client runs over. A registry can start from another layer (tests do) with
 * `initialValues: [[historyProtocol, layer]]`; the browser uses the HTTP one at `/api/history`.
 */
export const historyProtocol = Atom.keepAlive(Atom.make(fetchProtocol))

/** The History RPC group as an atom service (D23). Query atoms below are built on `HistoryClient.query`. */
export class HistoryClient extends AtomRpc.Service<HistoryClient>()('glanceboard/HistoryClient', {
  group: HistoryRpcs,
  protocol: (get) => get(historyProtocol),
}) {}

/** Effect 4 compares plain objects structurally, so equal payloads reach the same family entry. */
const queryFamily = <P extends object, T extends object>(build: (payload: P) => T) => Atom.family(build)

const filterKey = (filter: Filter) =>
  [filter.competition, filter.fromSeason ?? '', filter.toSeason ?? '', filter.goaliePartners ? 'gp' : 'no-gp'].join(',')

const isTransportError = (error: unknown): error is RpcClientError.RpcClientError => (
  typeof error === 'object' && error !== null && (error as { readonly _tag?: unknown })._tag === 'RpcClientError'
)

const transportFailed = new HistoryUnavailable({ message: 'The history service could not be reached. Try again.' })

/** What every query atom reports: the call's own errors, with a transport failure translated to `HistoryUnavailable`. */
type Translated<E> = Exclude<E, RpcClientError.RpcClientError> | HistoryUnavailable
type Result<A, E> = AsyncResult.AsyncResult<A, Translated<E>>

const translateError = <E>(error: E): Translated<E> => (
  isTransportError(error) ? transportFailed : error as Exclude<E, RpcClientError.RpcClientError>
)

const translateSuccess = <A, E>(success: AsyncResult.Success<A, E>): AsyncResult.Success<A, Translated<E>> => (
  AsyncResult.success(success.value, { waiting: success.waiting, timestamp: success.timestamp })
)

/** Every variant is handled, so a new one fails to compile here. */
const translate = <A, E>(result: AsyncResult.AsyncResult<A, E>): Result<A, E> => Match.valueTags(result, {
  Initial: (initial): Result<A, E> => AsyncResult.initial(initial.waiting),
  Success: translateSuccess,
  Failure: (failure): Result<A, E> => AsyncResult.failure(Cause.map(failure.cause, translateError), {
    previousSuccess: Option.map(failure.previousSuccess, translateSuccess),
    waiting: failure.waiting,
  }),
})

/** AtomRpc owns the codec. Preserve a hydrated snapshot until an explicit refresh. */
const fromQuery = <A, E>(query: Atom.Atom<AsyncResult.AsyncResult<A, E>>) => {
  // defect: every history query supplies a serialization key and returns a unary RPC result
  if (!Atom.isSerializable(query)) throw new Error('History query is missing AtomRpc serialization')
  const serialization = query[Atom.SerializableTypeId]
  const hydrating = Object.assign(Atom.setIdleTTL(query, timeToLive), {
    [Atom.SerializableTypeId]: {
      ...serialization,
      // Keep server-rendered history snapshots readable across the switch to AtomRpc's codec.
      key: serialization.key.replace(/^AtomRpc:/, 'history:'),
      skipInitialRun: true,
    },
  })
  return Atom.map(hydrating, translate)
}

export const searchPlayers = queryFamily((p: Payload<typeof SearchPlayersInput>) =>
  fromQuery(HistoryClient.query('SearchPlayers', p, { serializationKey: `${p.query.length}:${p.query}:${p.limit}` })))

export const player = queryFamily((p: Payload<typeof GetPlayerInput>) =>
  fromQuery(HistoryClient.query('GetPlayer', p, { serializationKey: String(p.playerId) })))

export const roster = queryFamily((p: Payload<typeof GetRosterInput>) =>
  fromQuery(HistoryClient.query('GetRoster', p, { serializationKey: `${p.teamId}:${p.seasonId}:${p.gameType}:${p.focusPlayerId ?? ''}` })))

export const link = queryFamily((p: Payload<typeof GetLinkInput>) =>
  fromQuery(HistoryClient.query('GetLink', p, { serializationKey: `${p.a}:${p.b}:${filterKey(p.filter)}` })))

export const sharedGames = queryFamily((p: Payload<typeof GetSharedGamesInput>) =>
  fromQuery(HistoryClient.query('GetSharedGames', p, { serializationKey: `${p.a}:${p.b}:${p.seasonId}:${p.gameType}:${p.teamId}:${p.link}` })))

export const opponents = queryFamily((p: Payload<typeof GetOpponentsInput>) =>
  fromQuery(HistoryClient.query('GetOpponents', p, { serializationKey: `${p.playerId}:${p.limit}:${p.offset}` })))

export const opposedGames = queryFamily((p: Payload<typeof GetOpposedGamesInput>) =>
  fromQuery(HistoryClient.query('GetOpposedGames', p, { serializationKey: `${p.a}:${p.b}` })))

export const findPath = queryFamily((p: Payload<typeof FindPathInput>) =>
  fromQuery(HistoryClient.query('FindPath', p, { serializationKey: `${p.from}:${p.to}:${p.relation}:${p.limit}:${filterKey(p.filter)}` })))

export const farthest = queryFamily((p: Payload<typeof GetFarthestInput>) =>
  fromQuery(HistoryClient.query('GetFarthest', p, { serializationKey: `${p.playerId}:${filterKey(p.filter)}` })))

export const finalsCoverage = queryFamily((p: Payload<typeof GetFinalsCoverageInput>) =>
  fromQuery(HistoryClient.query('GetFinalsCoverage', p, { serializationKey: `${p.playerId}:${p.fromYear}:${p.toYear}` })))
