import { useRef, useState } from 'react'
import { Option, Schema } from 'effect'
import { Text, View } from 'tamagui'
import { samples } from '@nhl-reddit-stats/viz/samples'
import { ViewData } from '@nhl-reddit-stats/viz'
import type { FrameReport, LabEntry } from '@nhl-reddit-stats/viz'
import type { ReactNode } from 'react'

import { VizFrameIsland } from '../../../islands/VizFrameIsland'

const toPrettyJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown, { space: 2 }))
const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))
const decodeViewData = Schema.decodeUnknownOption(Schema.fromJsonString(ViewData))

const starterData = toPrettyJson({ tables: samples.chain.tables, notes: samples.chain.notes })
const badData = 'The view data is not valid JSON of the form { "tables": ..., "notes": ... }.'

// A hand-written view module for the chain sample. It draws each hop as a list item in the theme's colours.
const starter = [
  'export default function view({ root, tables, theme }) {',
  '  const list = document.createElement("ul")',
  '  list.style.color = theme.color',
  '  list.style.background = theme.background',
  '  list.style.fontFamily = theme.fonts.body',
  '  for (const hop of tables.hops) {',
  '    const item = document.createElement("li")',
  '    item.textContent = "chain " + hop.chain + " step " + hop.step + ": " + hop.from + " to " + hop.to + " (" + hop.games + " games)"',
  '    list.append(item)',
  '  }',
  '  root.append(list)',
  '  return () => list.remove()',
  '}',
].join('\n')

const describe = (report: FrameReport): string =>
  report._tag === 'Ready' ? 'Ready'
  : report._tag === 'Failed' ? `Failed ${report.id}: ${report.message}`
  : `${report._tag} ${report.id}`

const hasId = (report: FrameReport): report is Exclude<FrameReport, { _tag: 'Ready' }> => report._tag !== 'Ready'

function Sandbox() {
  const [draft, setDraft] = useState(starter)
  const [dataDraft, setDataDraft] = useState(starterData)
  const [code, setCode] = useState(starter)
  const [tables, setTables] = useState(samples.chain.tables as ViewData['tables'])
  const [problem, setProblem] = useState('')
  // The reports of the current render: a Run starts a new list, and so does a report with a new render id.
  const [reports, setReports] = useState<ReadonlyArray<FrameReport>>([])
  const currentId = useRef('')
  const run = () => {
    const decoded = decodeViewData(dataDraft)
    if (Option.isNone(decoded)) { setProblem(badData); return }
    setProblem('')
    currentId.current = ''
    setReports([])
    setTables(decoded.value.tables)
    setCode(draft)
  }
  const onReport = (report: FrameReport) => {
    if (hasId(report) && report.id !== currentId.current) {
      currentId.current = report.id
      setReports([report])
      return
    }
    setReports((previous) => [...previous, report])
  }
  const rates = reports.filter((report) => report._tag === 'FrameRate')
  const latest = rates.at(-1)
  const shown = reports.filter((report) => report._tag !== 'FrameRate').slice(-8)
  return (
    <View gap="3">
      <textarea aria-label="View module" rows={14} cols={90} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <textarea aria-label="View data" rows={8} cols={90} value={dataDraft} onChange={(event) => setDataDraft(event.target.value)} />
      <button type="button" aria-label="Run" onClick={run}>Run</button>
      {problem ? <Text role="alert" fontFamily="body" color="color">{problem}</Text> : null}
      <VizFrameIsland code={code} tables={tables} onReport={onReport} />
      <Text fontFamily="body" color="color">
        {`Frame rate: ${latest?._tag === 'FrameRate' ? latest.fps : 'none yet'} (samples: ${rates.length})`}
      </Text>
      <View render="ol" aria-label="Last messages">
        {shown.map((report, index) => <Text key={index} render="li" fontFamily="body" color="color">{describe(report)}</Text>)}
      </View>
      <pre data-testid="frame-reports" hidden>{toJson(reports)}</pre>
    </View>
  )
}

const entry: LabEntry<ReactNode> = {
  title: 'Sandbox: a view module in the frame',
  render: () => <Sandbox />,
}

export default entry
