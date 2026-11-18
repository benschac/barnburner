// A filter for honest mistakes in a model-written view module. It runs before the
// module reaches the frame, so the repair loop (FM3) can fix an obvious slip, such as
// an import or a stray fetch. It is not the security boundary. The sandboxed frame is
// (D17): opaque origin, no network, no access to the explorer. A determined module can
// get past this scan, and the frame still stops it.
//
// It is a regex filter, not a parser. Known limits, left alone on purpose:
// - Regex literals are not recognised. A quote inside one can hide the code after it from the scan.
// - A quoted export name, such as export { render as "default" }, is not recognised as a default export.
// - Only \n ends a line here. U+2028 and U+2029 do not end a line comment or count as line breaks.

export type ViewCodeProblem =
  | { readonly _tag: 'MissingDefaultExport' }
  | { readonly _tag: 'ModuleLoader'; readonly keyword: 'import' | 'require'; readonly line: number }
  | { readonly _tag: 'ForbiddenGlobal'; readonly name: string; readonly line: number }

const OWNERS = new Set(['window', 'self', 'globalThis', 'document', 'navigator', 'top', 'parent'])
// Properties that are forbidden on any owner in OWNERS, such as window.parent or top.open.
const ownerProperties = new Set(['parent', 'top', 'open'])
const forbiddenGlobals = new Set([
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'RTCPeerConnection',
  'localStorage', 'sessionStorage', 'indexedDB', 'location', 'eval',
])

const identifier = /(?<![\w$])[A-Za-z_$][\w$]*(?![\w$])/g
// import and require, as a keyword or after a spread (...require). A property such as row.import is not a load.
const moduleLoader = /(?:(?<![\w$.])|(?<=\.\.\.))(import|require)(?![\w$])/g
// export * from, export { ... } from: a re-export loads a module.
const reExport = /(?<![\w$.])export\s*(?:\*(?:\s*as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s*from(?![\w$])/g
const newFunction = /(?<![\w$.])new\s+Function(?![\w$])/g
const declaration = /(?<![\w$.])(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g
const defaultExport = /(?<![\w$])export\s+default(?![\w$])|(?<![\w$])export\s*\{[^}]*\bas\s+default(?![\w$])/
// Context before a name: a property access (a.b, a?.b), a spread (...b), an owner (window in window?.open).
const propertyAccess = /\??\.\s*$/
const spreadAccess = /\.\.\.\s*$/
const ownerBeforeAccess = /([A-Za-z_$][\w$]*)\s*\??\.\s*$/
// An object-literal key: { location: [x, y] } or , location: ...
const objectKeyContext = /[{,]\s*$/
const objectKeyAfter = /^\s*:/
const CONTEXT = 200

function ownedForbidden(owner: string, name: string): boolean {
  return forbiddenGlobals.has(name) || ownerProperties.has(name) || (owner === 'document' && name === 'cookie')
}

// Blanks comments, string literals and template text, so only code is scanned.
// Template `${...}` expressions are kept, because they run as code. Line breaks survive, so line numbers stay right.
function maskCode(source: string): string {
  const blank = (text: string): string => text.replace(/[^\n]/g, ' ')
  let out = ''
  let i = 0
  let depth = 0
  // The brace depth at each open `${`, so the matching } returns to template text.
  const expressionDepths: number[] = []
  let inTemplate = false
  while (i < source.length) {
    const ch = source[i]
    if (inTemplate) {
      if (ch === '\\') {
        out += blank(source.slice(i, i + 2))
        i += 2
      } else if (ch === '`') {
        out += ' '
        inTemplate = false
        i += 1
      } else if (ch === '$' && source[i + 1] === '{') {
        out += '  '
        expressionDepths.push(depth)
        depth += 1
        inTemplate = false
        i += 2
      } else {
        out += blank(ch)
        i += 1
      }
      continue
    }
    const next = source[i + 1]
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      out += blank(source.slice(i, stop))
      i = stop
    } else if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      out += blank(source.slice(i, stop))
      i = stop
    } else if (ch === "'" || ch === '"') {
      let j = i + 1
      while (j < source.length && source[j] !== ch && source[j] !== '\n') {
        j += source[j] === '\\' ? 2 : 1
      }
      const stop = Math.min(j + 1, source.length)
      out += blank(source.slice(i, stop))
      i = stop
    } else if (ch === '`') {
      out += ' '
      inTemplate = true
      i += 1
    } else if (ch === '}' && expressionDepths.length > 0 && expressionDepths[expressionDepths.length - 1] === depth - 1) {
      expressionDepths.pop()
      depth -= 1
      inTemplate = true
      out += ' '
      i += 1
    } else {
      if (ch === '{') depth += 1
      if (ch === '}') depth -= 1
      out += ch
      i += 1
    }
  }
  return out
}

const lineOf = (code: string, index: number): number => code.slice(0, index).split('\n').length

type Found = { readonly index: number; readonly problem: ViewCodeProblem }

// Returns the problems in one view module, or an empty list when none is found.
export function checkViewCode(code: string): ReadonlyArray<ViewCodeProblem> {
  const masked = maskCode(code)
  const found: Found[] = []
  const add = (index: number, problem: (line: number) => ViewCodeProblem): void => {
    found.push({ index, problem: problem(lineOf(masked, index)) })
  }

  for (const match of masked.matchAll(moduleLoader)) {
    const keyword: 'import' | 'require' = match[1] === 'import' ? 'import' : 'require'
    add(match.index, (line) => ({ _tag: 'ModuleLoader', keyword, line }))
  }
  for (const match of masked.matchAll(reExport)) {
    add(match.index, (line) => ({ _tag: 'ModuleLoader', keyword: 'import', line }))
  }
  for (const match of masked.matchAll(newFunction)) {
    add(match.index, (line) => ({ _tag: 'ForbiddenGlobal', name: 'new Function', line }))
  }

  // A name the module declares itself is its own, not the global, so a bare use of it is not reported.
  const declared = new Set([...masked.matchAll(declaration)].map((match) => match[1]))
  for (const match of masked.matchAll(identifier)) {
    const name = match[0]
    const before = masked.slice(Math.max(0, match.index - CONTEXT), match.index)
    if (propertyAccess.test(before) && !spreadAccess.test(before)) {
      // A property: reported only on a browser owner, so row.location and d.fetch pass.
      const owner = ownerBeforeAccess.exec(before)?.[1]
      if (owner !== undefined && OWNERS.has(owner) && ownedForbidden(owner, name)) {
        add(match.index, (line) => ({ _tag: 'ForbiddenGlobal', name: owner + '.' + name, line }))
      }
      continue
    }
    if (!forbiddenGlobals.has(name) || declared.has(name)) continue
    const after = masked.slice(match.index + name.length, match.index + name.length + CONTEXT)
    if (objectKeyContext.test(before) && objectKeyAfter.test(after)) continue
    add(match.index, (line) => ({ _tag: 'ForbiddenGlobal', name, line }))
  }

  const problems = found.sort((a, b) => a.index - b.index).map((entry) => entry.problem)
  if (!defaultExport.test(masked)) return [{ _tag: 'MissingDefaultExport' }, ...problems]
  return problems
}
