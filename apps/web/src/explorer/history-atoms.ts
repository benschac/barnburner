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

type Tag = Parameters<typeof HistoryClient.query>[0]

/**
 * Wraps a raw query atom. The raw atom is what the registry dehydrates, under `history:<call>:<key>`; it keeps a
 * hydrated value as it is (`skipInitialRun`) until a refresh or its time to live. The atom handed out has the
 * translated error type in every variant, so `RpcClientError` never reaches the explorer.
 */
const unavailable = <A, E>(tag: Tag, key: string, raw: Atom.Atom<AsyncResult.AsyncResult<A, E>>): Atom.Atom<Result<A, E>> => {
  const rpc = HistoryRpcs.requests.get(tag)
  // defect: every Tag names a member of HistoryRpcs
  if (rpc === undefined) throw new Error(`No RPC named ${tag}`)
  const schema = AsyncResult.Schema({
    success: rpc.successSchema,
    error: Schema.Union([rpc.errorSchema, RpcClientError.RpcClientError]),
  }) as unknown as Schema.Codec<AsyncResult.AsyncResult<A, E>, unknown>
  const hydrating = Atom.serializable(raw, { key: `history:${tag}:${key}`, schema, skipInitialRun: true })
  return Atom.map(hydrating, translate)
}

const options = { timeToLive }

export const searchPlayers = queryFamily((p: Payload<typeof SearchPlayersInput>) =>
  unavailable('SearchPlayers', `${p.query.length}:${p.query}:${p.limit}`, HistoryClient.query('SearchPlayers', p, options)))

export const player = queryFamily((p: Payload<typeof GetPlayerInput>) =>
  unavailable('GetPlayer', String(p.playerId), HistoryClient.query('GetPlayer', p, options)))

export const roster = queryFamily((p: Payload<typeof GetRosterInput>) =>
  unavailable('GetRoster', `${p.teamId}:${p.seasonId}:${p.gameType}:${p.focusPlayerId ?? ''}`, HistoryClient.query('GetRoster', p, options)))

export const link = queryFamily((p: Payload<typeof GetLinkInput>) =>
  unavailable('GetLink', `${p.a}:${p.b}:${filterKey(p.filter)}`, HistoryClient.query('GetLink', p, options)))

export const sharedGames = queryFamily((p: Payload<typeof GetSharedGamesInput>) =>
  unavailable('GetSharedGames', `${p.a}:${p.b}:${p.seasonId}:${p.gameType}:${p.teamId}:${p.link}`, HistoryClient.query('GetSharedGames', p, options)))

export const opponents = queryFamily((p: Payload<typeof GetOpponentsInput>) =>
  unavailable('GetOpponents', `${p.playerId}:${p.limit}:${p.offset}`, HistoryClient.query('GetOpponents', p, options)))

export const opposedGames = queryFamily((p: Payload<typeof GetOpposedGamesInput>) =>
  unavailable('GetOpposedGames', `${p.a}:${p.b}`, HistoryClient.query('GetOpposedGames', p, options)))

export const findPath = queryFamily((p: Payload<typeof FindPathInput>) =>
  unavailable('FindPath', `${p.from}:${p.to}:${p.relation}:${p.limit}:${filterKey(p.filter)}`, HistoryClient.query('FindPath', p, options)))

export const farthest = queryFamily((p: Payload<typeof GetFarthestInput>) =>
  unavailable('GetFarthest', `${p.playerId}:${filterKey(p.filter)}`, HistoryClient.query('GetFarthest', p, options)))

export const finalsCoverage = queryFamily((p: Payload<typeof GetFinalsCoverageInput>) =>
  unavailable('GetFinalsCoverage', `${p.playerId}:${p.fromYear}:${p.toYear}`, HistoryClient.query('GetFinalsCoverage', p, options)))
