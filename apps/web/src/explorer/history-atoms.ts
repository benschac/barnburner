import { Cause, Duration, Layer, Match, Option, Schema } from 'effect'
import { AsyncResult, Atom, AtomRpc } from 'effect/reactivity'
import { FetchHttpClient } from 'effect/http'
import { Rpc, RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc'
import {
  FindPath, FindPathInput, GetFarthest, GetFarthestInput, GetFinalsCoverage, GetFinalsCoverageInput, GetLink, GetLinkInput,
  GetOpponents, GetOpponentsInput, GetOpposedGames, GetOpposedGamesInput, GetPlayer, GetPlayerInput, GetRoster,
  GetRosterInput, GetSharedGames, GetSharedGamesInput, HistoryRpcs, HistoryUnavailable, SearchPlayers, SearchPlayersInput,
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

const isTransportError = Schema.is(RpcClientError.RpcClientError)

const transportFailed = new HistoryUnavailable({ message: 'The history service could not be reached. Try again.' })

/** What every query atom reports: the call's own errors `E`, with a transport failure translated to `HistoryUnavailable`. */
type Result<A, E> = AsyncResult.AsyncResult<A, E | HistoryUnavailable>

const translateError = <E>(error: E | RpcClientError.RpcClientError): E | HistoryUnavailable => (
  isTransportError(error) ? transportFailed : error
)

const translateSuccess = <A, E>(
  success: AsyncResult.Success<A, E | RpcClientError.RpcClientError>,
): AsyncResult.Success<A, E | HistoryUnavailable> => (
  AsyncResult.success(success.value, { waiting: success.waiting, timestamp: success.timestamp })
)

/** Every variant is handled, so a new one fails to compile here. */
const translate = <A, E>(result: AsyncResult.AsyncResult<A, E | RpcClientError.RpcClientError>): Result<A, E> =>
  Match.valueTags(result, {
    Initial: (initial): Result<A, E> => AsyncResult.initial(initial.waiting),
    Success: (success): Result<A, E> => translateSuccess<A, E>(success),
    Failure: (failure): Result<A, E> => AsyncResult.failure(Cause.map(failure.cause, translateError<E>), {
      previousSuccess: Option.map(failure.previousSuccess, translateSuccess<A, E>),
      waiting: failure.waiting,
    }),
  })

/** Hydration decodes synchronously, so neither schema may need services. */
type NoServices = Schema.Top & Schema.ConstraintCodec<unknown, unknown>

/**
 * Makes a query atom hydratable under `history:<tag>:<key>`, with the RPC's own success and error schemas plus the
 * transport error. A hydrated snapshot is kept until an explicit refresh, since a snapshot's answers never change.
 */

const fromQuery = <S extends NoServices, F extends NoServices>(
  rpc: Pick<Rpc.AnyWithProps, '_tag'> & { readonly successSchema: S, readonly errorSchema: F },
  key: string,
  query: Atom.Atom<AsyncResult.AsyncResult<S['Type'], F['Type'] | RpcClientError.RpcClientError>>,
) => Atom.map(Atom.serializable(query, {
  key: `history:${rpc._tag}:${key}`,
  schema: AsyncResult.Schema({ success: rpc.successSchema, error: Schema.Union([rpc.errorSchema, RpcClientError.RpcClientError]) }),
  skipInitialRun: true,
}), translate<S['Type'], F['Type']>)

const options = { timeToLive } as const

export const searchPlayers = queryFamily((p: Payload<typeof SearchPlayersInput>) =>
  fromQuery(SearchPlayers, `${p.query.length}:${p.query}:${p.limit}`, HistoryClient.query(SearchPlayers._tag, p, options)))

export const player = queryFamily((p: Payload<typeof GetPlayerInput>) =>
  fromQuery(GetPlayer, String(p.playerId), HistoryClient.query(GetPlayer._tag, p, options)))

export const roster = queryFamily((p: Payload<typeof GetRosterInput>) =>
  fromQuery(GetRoster, `${p.teamId}:${p.seasonId}:${p.gameType}:${p.focusPlayerId ?? ''}`, HistoryClient.query(GetRoster._tag, p, options)))

export const link = queryFamily((p: Payload<typeof GetLinkInput>) =>
  fromQuery(GetLink, `${p.a}:${p.b}:${filterKey(p.filter)}`, HistoryClient.query(GetLink._tag, p, options)))

export const sharedGames = queryFamily((p: Payload<typeof GetSharedGamesInput>) =>
  fromQuery(GetSharedGames, `${p.a}:${p.b}:${p.seasonId}:${p.gameType}:${p.teamId}:${p.link}`, HistoryClient.query(GetSharedGames._tag, p, options)))

export const opponents = queryFamily((p: Payload<typeof GetOpponentsInput>) =>
  fromQuery(GetOpponents, `${p.playerId}:${p.limit}:${p.offset}`, HistoryClient.query(GetOpponents._tag, p, options)))

export const opposedGames = queryFamily((p: Payload<typeof GetOpposedGamesInput>) =>
  fromQuery(GetOpposedGames, `${p.a}:${p.b}`, HistoryClient.query(GetOpposedGames._tag, p, options)))

export const findPath = queryFamily((p: Payload<typeof FindPathInput>) =>
  fromQuery(FindPath, `${p.from}:${p.to}:${p.relation}:${p.limit}:${filterKey(p.filter)}`, HistoryClient.query(FindPath._tag, p, options)))

export const farthest = queryFamily((p: Payload<typeof GetFarthestInput>) =>
  fromQuery(GetFarthest, `${p.playerId}:${filterKey(p.filter)}`, HistoryClient.query(GetFarthest._tag, p, options)))

export const finalsCoverage = queryFamily((p: Payload<typeof GetFinalsCoverageInput>) =>
  fromQuery(GetFinalsCoverage, `${p.playerId}:${p.fromYear}:${p.toYear}`, HistoryClient.query(GetFinalsCoverage._tag, p, options)))
