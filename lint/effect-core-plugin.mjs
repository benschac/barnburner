// Enforces "Effect core modules" in AGENTS.md: native patterns that @effect/tsgo does not report.
// Each message names the core module API to use; .agent-sources/effect/native-to-effect.md
// lists the replacements and core-index.md leads to their declarations.

const LOOP = /\/\/\s*loop:\s*\S/
const LOOPS = new Set(['ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement', 'DoWhileStatement'])
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

// Type-only and grouping wrappers do not change what is spread: `new Set(x) as Set<number>`, `(new Set(x))`.
const TRANSPARENT = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'ParenthesizedExpression', 'ChainExpression'])
const unwrap = (node) => (node && TRANSPARENT.has(node.type) ? unwrap(node.expression) : node)

const isNewSet = (node) => {
  const set = unwrap(node)
  return set?.type === 'NewExpression' && set.callee.type === 'Identifier' && set.callee.name === 'Set'
}

// `new Set([...a, ...b])`: two or more spreads and nothing else, the concatenate-and-dedupe idiom.
const isConcatenation = (node) => {
  const set = unwrap(node)
  if (!isNewSet(set)) return false
  const list = unwrap(set.arguments[0])
  return list?.type === 'ArrayExpression' && list.elements.length >= 2 && list.elements.every((e) => e?.type === 'SpreadElement')
}

// A capitalized receiver is a module namespace (Array.sort, Chunk.sort), not an array value.
const isModule = (node) => node.type === 'Identifier' && /^[A-Z]/.test(node.name)

// The rules apply to Effect code: a file that imports from effect or an @effect package.
const importsEffect = (context) =>
  context.sourceCode.ast.body.some((s) => s.type === 'ImportDeclaration' && /^(effect|@effect\/)/.test(s.source.value))

export default {
  meta: { name: 'core' },
  rules: {
    'no-native-sort': {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        if (!importsEffect(context)) return {}
        return {
          CallExpression(node) {
            const callee = node.callee
            if (callee.type !== 'MemberExpression' || callee.computed || isModule(callee.object)) return
            if (callee.property.name !== 'sort' && callee.property.name !== 'toSorted') return
            context.report({
              node,
              message: `Native \`.${callee.property.name}\` sorts with a hand-written comparator (or by string when it has none). Fix: Array.sort(xs, Order.Number), Array.sortWith(xs, key, order), or Array.sortBy(...orders) from 'effect'.`,
            })
          },
        }
      },
    },
    'no-set-dedupe': {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        if (!importsEffect(context)) return {}
        const report = (node, what = 'Spreading a Set to remove duplicates') =>
          context.report({ node, message: `${what}. Fix: Array.dedupe(xs), or Array.dedupeWith for a custom equivalence, from 'effect'. To combine two collections, Array.dedupe(Array.appendAll(a, b)) or Array.union; to test membership, HashSet.fromIterable.` })
        return {
          ArrayExpression(node) {
            if (node.elements.some((e) => e?.type === 'SpreadElement' && isNewSet(e.argument))) report(node)
          },
          CallExpression(node) {
            const callee = node.callee
            if (callee.type !== 'MemberExpression' || callee.computed) return
            if (callee.object.type === 'Identifier' && callee.object.name === 'Array' && callee.property.name === 'from' && isNewSet(node.arguments[0])) report(node, 'Array.from over a Set to remove duplicates')
          },
          ForOfStatement(node) {
            if (isNewSet(node.right)) report(node.right, 'Iterating a new Set to remove duplicates')
          },
          NewExpression(node) {
            if (isConcatenation(node)) report(node, 'Concatenating arrays into a Set to remove duplicates')
          },
        }
      },
    },
    'no-yield-in-loop': {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        const lines = context.sourceCode.text.split('\n')
        return {
          YieldExpression(node) {
            if (!node.delegate) return
            let child = node
            for (let parent = node.parent; parent && !FUNCTIONS.has(parent.type); child = parent, parent = parent.parent) {
              if (!LOOPS.has(parent.type) || child !== parent.body) continue
              if (LOOP.test(lines[parent.loc.start.line - 2] ?? '')) return
              context.report({
                node,
                message: 'yield* inside a loop body runs one effect per element by hand. Fix: Effect.forEach(xs, f) (add { concurrency } when calls are independent) or Effect.reduce for running state. When the loop must break early or poll, put a "// loop: <reason>" comment on the line above it.',
              })
              return
            }
          },
        }
      },
    },
  },
}
