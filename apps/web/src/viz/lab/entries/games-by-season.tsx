import { Result, Schema } from 'effect'
import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { PairTables } from '@nhl-reddit-stats/viz'
import type { LabEntry } from '@nhl-reddit-stats/viz'
import { samples } from '@nhl-reddit-stats/viz/samples'

import { G2Chart } from '../../G2Chart'
import { asG2Spec, gamesBySeason } from '../../specs/games-by-season'
import { teamColor, useVizTheme } from '../../theme'

// Games by season (plan FV11): the FV9 spec in the G2 host, on the pair sample, or on an exported pair file.

const ExportFile = Schema.Struct({ tables: PairTables })
const decodeJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown))
const decodeExport = Schema.decodeUnknownResult(ExportFile)

function readExport(text: string): Result.Result<PairTables, string> {
  const parsed = decodeJson(text)
  if (Result.isFailure(parsed)) return Result.fail(`not JSON: ${parsed.failure.message}`)
  const file = decodeExport(parsed.success)
  if (Result.isFailure(file)) return Result.fail('expected an exported pair file: { tables, notes }')
  return Result.succeed(file.success.tables)
}

function GamesBySeasonPage() {
  const theme = useVizTheme()
  const [loaded, setLoaded] = useState<PairTables | undefined>(undefined)
  const [note, setNote] = useState('')
  const tables = loaded ?? samples.pair.tables
  const spec = asG2Spec(gamesBySeason(tables, theme, (abbrev, index) => teamColor(abbrev, theme, index)))

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const decoded = readExport(await file.text())
    if (Result.isSuccess(decoded)) {
      setLoaded(decoded.success)
      setNote(`Loaded ${file.name}.`)
    } else {
      setNote(decoded.failure)
    }
  }

  return (
    <section>
      <label>Exported pair file{' '}
        <input type="file" accept="application/json" onChange={(event) => { void onFile(event) }} />
      </label>
      <p role="status">{note || 'Showing the pair sample.'}</p>
      <G2Chart spec={spec} height="seasonChart" />
    </section>
  )
}

const entry: LabEntry<ReactNode> = {
  title: 'Games by season: two players',
  render: () => <GamesBySeasonPage />,
}

export default entry
