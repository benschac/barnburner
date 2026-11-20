import { Result, Schema } from 'effect'
import { useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { FinalsTables } from '@nhl-reddit-stats/viz'
import type { LabEntry } from '@nhl-reddit-stats/viz'
import { samples } from '@nhl-reddit-stats/viz/samples'

import { G2Chart } from '../../G2Chart'
import { finalsGrid } from '../../specs/finals-grid'
import { useVizTheme } from '../../theme'

// The Final-by-year grid (plan FV11): the FV10 spec in the G2 host, on the finals sample, or on an exported finals file.

/** An expected failure reading an exported finals file: unreadable, not JSON, or the wrong shape. */
class FinalsFileError extends Schema.TaggedError<FinalsFileError, { readonly brand: unique symbol }>()('FinalsFileError', {
  file: Schema.String,
  message: Schema.String,
}) {}

const ExportFile = Schema.Struct({ tables: FinalsTables, notes: Schema.String })
const decodeJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown))
const decodeExport = Schema.decodeUnknownResult(ExportFile)

const readText = (file: File): Promise<Result.Result<string, FinalsFileError>> =>
  file.text().then(
    (text) => Result.succeed(text),
    (cause) => Result.fail(new FinalsFileError({ file: file.name, message: `could not read the file: ${String(cause)}` })),
  )

function readExport(name: string, text: string): Result.Result<FinalsTables, FinalsFileError> {
  const parsed = decodeJson(text)
  if (Result.isFailure(parsed)) {
    return Result.fail(new FinalsFileError({ file: name, message: `not JSON: ${parsed.failure.message}` }))
  }
  const decoded = decodeExport(parsed.success)
  if (Result.isFailure(decoded)) {
    return Result.fail(new FinalsFileError({ file: name, message: 'expected an exported finals file: { tables, notes }' }))
  }
  return Result.succeed(decoded.success.tables)
}

function FinalsGridPage() {
  const theme = useVizTheme()
  const [loaded, setLoaded] = useState<FinalsTables | undefined>(undefined)
  const [note, setNote] = useState('')
  // Counts file selections, so a read that finishes after a newer selection is dropped.
  const selection = useRef(0)
  const tables = loaded ?? samples.finals.tables
  const spec = finalsGrid(tables, theme)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    selection.current += 1
    const token = selection.current
    const text = await readText(file)
    if (Result.isFailure(text)) {
      if (token === selection.current) setNote(text.failure.message)
      return
    }
    const decoded = readExport(file.name, text.success)
    if (token !== selection.current) return
    if (Result.isSuccess(decoded)) {
      setLoaded(decoded.success)
      setNote(`Loaded ${file.name}.`)
    } else {
      setNote(decoded.failure.message)
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
