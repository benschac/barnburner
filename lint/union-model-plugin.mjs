// Enforces the union model in AGENTS.md. A union of object shapes needs a literal discriminant,
// so callers branch on a tag (Match.valueTags, Match.tagsExhaustive) instead of probing for keys.

const FOREIGN = /\/\/\s*foreign:\s*\S/

const literalKeys = (member) =>
  new Set(
    member.members
      .filter((m) => m.type === 'TSPropertySignature' && !m.computed && m.typeAnnotation?.typeAnnotation.type === 'TSLiteralType')
      .map((m) => m.key.name ?? m.key.value),
  )

export default {
  meta: { name: 'unions' },
  rules: {
    discriminated: {
      meta: { type: 'problem', schema: [] },
      create(context) {
        return {
          TSUnionType(node) {
            const shapes = node.types.filter((t) => t.type === 'TSTypeLiteral')
            if (shapes.length < 2) return
            const [first, ...rest] = shapes.map(literalKeys)
            if ([...first].some((key) => rest.every((keys) => keys.has(key)))) return
            context.report({
              node,
              message: 'Union of object shapes has no shared literal discriminant. Fix: give every member a `_tag` and branch with Match.valueTags.',
            })
          },
        }
      },
    },
    'no-in-narrowing': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        const lines = context.sourceCode.text.split('\n')
        return {
          BinaryExpression(node) {
            if (node.operator !== 'in' || node.left.type !== 'Literal') return
            if (FOREIGN.test(lines[node.loc.start.line - 2] ?? '')) return
            context.report({
              node,
              message: 'Key probing with `in` hides a missing discriminant. Fix: tag the union and use Match, or mark untyped external data with a "// foreign: <reason>" comment on the line above.',
            })
          },
        }
      },
    },
  },
}
