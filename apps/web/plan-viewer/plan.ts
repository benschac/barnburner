import { createHash } from 'node:crypto'

const tableRows = (text: string) => text.split('\n')
  .filter((line) => line.startsWith('|'))
  .map((line) => line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => cell.trim().replaceAll('\\|', '|')))
  .filter((row) => !row.every((cell) => /^[- :]+$/.test(cell)))

const expandIds = (id: string) => {
  const range = id.match(/^([A-Z]+)(\d+)–\1(\d+)$/)
  return range
    ? Array.from({ length: Number(range[3]) - Number(range[2]) + 1 }, (_, index) => range[1] + (Number(range[2]) + index))
    : [id]
}

const prerequisiteTitles: Record<string, string> = {
  'P-plan': 'Commit the plan & initialise Graphite',
  'P-deps': 'Approve dependencies',
  'P-key': 'Provide an AI Gateway key',
  'P-pr': 'Enable CI pull requests',
  'P-rights': 'Confirm data rights',
}

export const parseAnalystPlan = (source: string) => {
  const sourceHash = createHash('sha256').update(source).digest('hex')
  const section = (name: string) => {
    const part = source.split('\n## ' + name + '\n')[1]
    if (part === undefined) throw new Error('Missing source section: ' + name)
    return part.split('\n## ')[0].trim()
  }
  const cardText = section('Task cards')
  const groups = [...cardText.matchAll(/^### (.+)$/gm)].map((match) => match[1])
  const cards = [...cardText.matchAll(/^#### (.+)\n([\s\S]*?)(?=^### |^#### |$(?![\s\S]))/gm)].map((match) => {
    const group = [...cardText.slice(0, match.index).matchAll(/^### (.+)$/gm)].at(-1)?.[1]
    if (!group) throw new Error('Task card has no workstream: ' + match[1])
    return { heading: match[1], body: match[2].trim(), ids: expandIds(match[1].split(' · ')[0]), group }
  })
  const tasks = tableRows(section('Ledger')).slice(1).flatMap(([ledgerId, model, needs, branch, pr, status, notes]) => expandIds(ledgerId).map((id) => {
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(id)) throw new Error('Invalid task ID: ' + id)
    const card = id.startsWith('P-')
      ? { heading: 'Prerequisites (you)', group: groups[0], body: cardText.split('\n').find((line) => line.startsWith('- **' + id + ':**')), ids: [id] }
      : cards.find((item) => item.ids.includes(id))
    if (!card?.body || !card.group) throw new Error('No task card for ' + id)
    const evalRow = card.ids.length > 1 && id.startsWith('E') ? tableRows(card.body).find((row) => row[0] === id) : undefined
    let title = id.startsWith('P-') ? prerequisiteTitles[id] : card.heading.split(' · ')[1]?.split(' (')[0]
    if (!title) throw new Error('No task title for ' + id)
    if (evalRow) title += ' / ' + evalRow[2].split('/').at(-1)?.replaceAll('`', '').replace('.json', '')
    if (card.ids.length > 1 && id.startsWith('X')) title += ' / ' + card.body.match(new RegExp('\\*\\*' + id + ', ([^:*]+)'))?.[1]
    return {
      id, group: card.ids.length > 1 ? card.heading.split(' · ')[0] : id,
      category: card.group, model: evalRow?.[1] ?? model,
      needs: needs === '–' ? [] : needs.split(',').flatMap((need) => expandIds(need.trim())),
      branch, pr, status, notes, title, heading: card.heading, body: card.body,
      parent: card.body.match(/\*\*Stack on:\*\* ([A-Z]+\d+[a-z]?)/)?.[1] ?? null,
    }
  }))
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) throw new Error('Duplicate ledger task IDs')
  for (const card of cards) {
    for (const id of card.ids) if (!tasks.some((task) => task.id === id)) throw new Error('Task card missing from ledger: ' + id)
  }
  for (const task of tasks) {
    if (!task.status) throw new Error('Missing ledger status: ' + task.id)
    for (const dependency of [...task.needs, ...(task.parent ? [task.parent] : [])]) {
      if (!tasks.some((item) => item.id === dependency)) throw new Error('Unknown dependency for ' + task.id + ': ' + dependency)
    }
  }
  const contracts = section('Contracts').split('\n### ').slice(1).map((part) => {
    const [title, ...body] = part.split('\n')
    return { title, body: body.join('\n').trim() }
  })
  const nodeId = (id: string) => 'n' + id.replaceAll('-', '')
  const dependencyDiagrams: Record<string, string> = Object.fromEntries(tasks.map((task) => {
    const dependents = tasks.filter((item) => item.needs.includes(task.id) || item.parent === task.id)
    const ids = new Set([task.id, ...task.needs, ...(task.parent ? [task.parent] : []), ...dependents.map((item) => item.id)])
    const lines = ['flowchart TD', ...[...ids].map((id) => nodeId(id) + '["' + id + (id === task.id ? ' (selected)' : '') + '"]')]
    for (const id of task.needs) lines.push(nodeId(id) + ' --> ' + nodeId(task.id))
    if (task.parent) lines.push(nodeId(task.parent) + ' -.-> ' + nodeId(task.id))
    for (const item of dependents) {
      if (item.needs.includes(task.id)) lines.push(nodeId(task.id) + ' --> ' + nodeId(item.id))
      if (item.parent === task.id) lines.push(nodeId(task.id) + ' -.-> ' + nodeId(item.id))
    }
    return [task.id, lines.join('\n')]
  }))
  return {
    tasks, groups: groups.map((title, number) => ({ number, title })), contracts,
    decisions: tableRows(section('Decisions (changes from the spec)')).slice(1).map(([id, decision, reason]) => ({ id, decision, reason })),
    record: section('System of record (Ratstack)'),
    routing: section('Orchestration').split('\nDispatch sketch')[0].trim(),
    criticalPath: section('Critical path'),
    sourceHash,
    hash: sourceHash.slice(0, 12),
    status: source.match(/^Status: (.+)$/m)?.[1] ?? 'See source plan',
    stacks: tasks.flatMap((task) => task.parent ? [[task.parent, task.id]] : []),
    dependencyDiagrams,
    pipelineDiagram: 'flowchart TD\nsource["Source snapshots"] --> db["Read-only DuckDB tables"]\ndb --> candidates["Detectors or generator"]\ncandidates --> verify["Canonical query evidence and verifier"]\nverify --> pending["Rank and store pending"]\npending --> human["Human review"]\nhuman --> approved["Approved API and poster"]\nhuman --> rejected["Rejected"]\napproved --> recheck["Recheck after refresh"]\nrecheck --> valid["Assertion holds: keep approved"]\nrecheck --> stale["Assertion fails or query errors: stale"]',
  }
}
