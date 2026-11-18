import { Result, Schema } from 'effect'
import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { FinalsTables } from '@nhl-reddit-stats/viz'
import type { LabEntry } from '@nhl-reddit-stats/viz'
import { samples } from '@nhl-reddit-stats/viz/samples'

import { G2Chart } from '../../G2Chart'
import { finalsGrid } from '../../specs/finals-grid'
import { useVizTheme } from '../../theme'

// The Final-by-year grid (plan FV11): the FV10 spec in the G2 host, on the finals sample, or on an exported finals file.

const ExportFile = Schema.Struct({ tables: FinalsTables })
const decodeJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown))
const decodeExport = Schema.decodeUnknownResult(ExportFile)

function readExport(text: string): Result.Result<FinalsTables, string> {
  const parsed = decodeJson(text)
  if (Result.isFailure(parsed)) return Result.fail(`not JSON: ${parsed.failure.message}`)
  const file = decodeExport(parsed.success)
  if (Result.isFailure(file)) return Result.fail('expected an exported finals file: { tables, notes }')
  return Result.succeed(file.success.tables)
}

function FinalsGridPage() {
  const theme = useVizTheme()
  const [loaded, setLoaded] = useState<FinalsTables | undefined>(undefined)
  const [note, setNote] = useState('')
  const tables = loaded ?? samples.finals.tables
  const spec = finalsGrid(tables, theme)

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
      <label>Exported finals file{' '}
        <input type="file" accept="application/json" onChange={(event) => { void onFile(event) }} />
      </label>
      <p role="status">{note || 'Showing the finals sample.'}</p>
      <G2Chart spec={spec} height="seasonChart" />
    </section>
  )
}

const entry: LabEntry<ReactNode> = {
  title: 'Finals grid: a Final year per cell',
  render: () => <FinalsGridPage />,
}

export default entry
