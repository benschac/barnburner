import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkViewCode } from '../src/check-view-code.ts'
import type { ViewCodeProblem } from '../src/check-view-code.ts'

const BT = String.fromCharCode(96) // a backtick, so template text can be written inside plain strings

const module = (body: string): string => [
  'export default function render(ctx) {',
  '  ' + body,
  '  return () => ctx.root.replaceChildren()',
  '}',
].join('\n')

const tags = (problems: ReadonlyArray<ViewCodeProblem>): string[] => problems.map((problem) => problem._tag)

test('a module with one default export and no forbidden names passes', () => {
  const code = module("ctx.root.textContent = 'ready'")
  assert.deepEqual(checkViewCode(code), [])
})

test('comments, strings and template text do not count as code', () => {
  const code = [
    '// fetch and import are only words here',
    '/* localStorage and require( in a block comment */',
    "const label = 'location and eval'",
    'const text = ' + BT + 'sendBeacon and ' + '${' + "'window.open'" + '}' + BT,
    'export default function render() { return label + text }',
  ].join('\n')
  assert.deepEqual(checkViewCode(code), [])
})

test('a template expression is still code and is scanned', () => {
  const code = 'export default function render() { return ' + BT + '${fetch("/api")}' + BT + ' }'
  assert.deepEqual(tags(checkViewCode(code)), ['ForbiddenGlobal'])
})

test('a module with no default export fails', () => {
  const code = 'export function render() { return () => {} }'
  assert.deepEqual(checkViewCode(code), [{ _tag: 'MissingDefaultExport' }])
})

test('a named export with as default counts as a default export', () => {
  const code = 'function render() { return () => {} }\nexport { render as default }'
  assert.deepEqual(checkViewCode(code), [])
})

test('an import fails and reports its line', () => {
  const code = "import { scaleLinear } from 'd3'\nexport default function render() { return () => {} }"
  assert.deepEqual(checkViewCode(code), [{ _tag: 'ModuleLoader', keyword: 'import', line: 1 }])
})

test('a dynamic import fails', () => {
  const code = "export default async function render() { await import('d3') }"
  assert.deepEqual(tags(checkViewCode(code)), ['ModuleLoader'])
})

test('a require fails', () => {
  const code = "const d3 = require('d3')\nexport default function render() { return () => {} }"
  assert.deepEqual(checkViewCode(code), [{ _tag: 'ModuleLoader', keyword: 'require', line: 1 }])
})

// One failing module for each forbidden global, with the name it is reported under.
const forbidden: [string, string][] = [
  ['fetch', "fetch('/api/games')"],
  ['XMLHttpRequest', 'new XMLHttpRequest()'],
  ['WebSocket', "new WebSocket('wss://example.com')"],
  ['EventSource', "new EventSource('/stream')"],
  ['navigator.sendBeacon', "navigator.sendBeacon('/log', 'x')"],
  ['RTCPeerConnection', 'new RTCPeerConnection()'],
  ['document.cookie', "document.cookie = 'a=1'"],
  ['localStorage', "localStorage.setItem('a', '1')"],
  ['sessionStorage', "sessionStorage.setItem('a', '1')"],
  ['indexedDB', "indexedDB.open('db')"],
  ['window.parent', "window.parent.postMessage('x', '*')"],
  ['window.top', "window.top.name = 'x'"],
  ['window.open', "window.open('https://example.com')"],
  ['location', "location.href = 'https://example.com'"],
  ['eval', "eval('1 + 1')"],
  ['new Function', "new Function('return 1')"],
]

for (const [name, snippet] of forbidden) {
  test('a module that uses ' + name + ' fails', () => {
    const problems = checkViewCode(module(snippet))
    assert.deepEqual(problems, [{ _tag: 'ForbiddenGlobal', name, line: 2 }])
  })
}

// Re-exports and spreads: a re-export loads a module, and a spread does not hide a require.
test('a re-export from another module fails', () => {
  const code = "export { render as default } from './chart.js'"
  assert.deepEqual(checkViewCode(code), [{ _tag: 'ModuleLoader', keyword: 'import', line: 1 }])
})

test('export star from another module fails', () => {
  const code = "export * from './x.js'"
  assert.deepEqual(checkViewCode(code), [{ _tag: 'MissingDefaultExport' }, { _tag: 'ModuleLoader', keyword: 'import', line: 1 }])
})

test('a spread require fails', () => {
  const code = "const defaults = { ...require('./defaults.js') }\nexport default function render() { return () => {} }"
  assert.deepEqual(checkViewCode(code), [{ _tag: 'ModuleLoader', keyword: 'require', line: 1 }])
})

// Optional chaining is reported like the plain dot.
const optionalChain: [string, string][] = [
  ['window.open', "window?.open('https://example.com')"],
  ['window.parent', "window?.parent.postMessage('x', '*')"],
  ['document.cookie', "document?.cookie = 'a=1'"],
]

for (const [name, snippet] of optionalChain) {
  test('an optional chain on ' + name + ' fails', () => {
    assert.deepEqual(checkViewCode(module(snippet)), [{ _tag: 'ForbiddenGlobal', name, line: 2 }])
  })
}

// Names that are not the global: properties of ordinary objects, object keys, and names the module declares.
test('a property of an ordinary object is not reported', () => {
  assert.deepEqual(checkViewCode(module('const value = row.location + d.fetch')), [])
})

test('an object-literal key is not reported', () => {
  assert.deepEqual(checkViewCode(module('const point = { location: [1, 2] }')), [])
})

test('a const the module declares is not reported', () => {
  assert.deepEqual(checkViewCode(module('const location = [1, 2]; ctx.root.dataset.x = String(location[0])')), [])
})

test('a let the module declares is not reported', () => {
  assert.deepEqual(checkViewCode(module('let fetch = 0; fetch += 1')), [])
})

// Still reported: bare uses, and properties of a browser owner.
const owned: [string, string][] = [
  ['window.fetch', "window.fetch('/api')"],
  ['globalThis.localStorage', "globalThis.localStorage.setItem('a', '1')"],
  ['document.location', "document.location.href = 'https://example.com'"],
]

for (const [name, snippet] of owned) {
  test('a property of ' + name.split('.')[0] + ' is reported as ' + name, () => {
    assert.deepEqual(checkViewCode(module(snippet)), [{ _tag: 'ForbiddenGlobal', name, line: 2 }])
  })
}
