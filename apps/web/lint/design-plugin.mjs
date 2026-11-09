import contract from '../design/contract.json' with { type: 'json' }

const colors = [...Object.keys(contract.themes.dark), 'background-hover', 'transparent']
const categories = new Map()
const add = (category, names) => names.split(' ').forEach((name) => categories.set(name, category))
add('colors', 'color bg background backgroundColor borderColor borderTopColor borderBottomColor borderLeftColor borderRightColor outlineColor shadowColor textShadowColor textDecorationColor caretColor borderBlockColor borderBlockStartColor borderBlockEndColor borderInlineColor borderInlineStartColor borderInlineEndColor borderStartColor borderEndColor fill stroke')
add('space', 'p px py pt pb pl pr padding paddingTop paddingBottom paddingLeft paddingRight paddingHorizontal paddingVertical m mx my mt mb ml mr margin marginTop marginBottom marginLeft marginRight marginHorizontal marginVertical gap rowGap columnGap paddingStart paddingEnd marginStart marginEnd paddingBlock paddingBlockStart paddingBlockEnd paddingInline paddingInlineStart paddingInlineEnd marginBlock marginBlockStart marginBlockEnd marginInline marginInlineStart marginInlineEnd inset insetBlock insetBlockStart insetBlockEnd insetInline insetInlineStart insetInlineEnd start end l r t b left right top bottom')
add('size', 'w h minW maxW minH maxH width height minWidth maxWidth minHeight maxHeight inlineSize minInlineSize maxInlineSize blockSize minBlockSize maxBlockSize flexBasis')
add('radius', 'rounded borderRadius borderTopLeftRadius borderTopRightRadius borderBottomLeftRadius borderBottomRightRadius borderTopStartRadius borderTopEndRadius borderBottomStartRadius borderBottomEndRadius borderStartStartRadius borderStartEndRadius borderEndStartRadius borderEndEndRadius')
add('fontSize', 'fontSize')
add('lineHeight', 'lineHeight')
add('fontFamily', 'fontFamily')
add('fontWeight', 'fontWeight')
add('letterSpacing', 'letterSpacing')
add('borderWidth', 'borderWidth borderTopWidth borderBottomWidth borderLeftWidth borderRightWidth borderStartWidth borderEndWidth borderBlockWidth borderBlockStartWidth borderBlockEndWidth borderInlineWidth borderInlineStartWidth borderInlineEndWidth outlineWidth')
for (const key of Object.keys(contract.geometry)) categories.set(key, 'geometry')
const nameOf = (node) => node?.name ?? node?.value
const unwrap = (node) => ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ParenthesizedExpression'].includes(node?.type) ? unwrap(node.expression) : node

function values(node, context, seen = new Set()) {
  node = unwrap(node)
  if (!node || seen.has(node)) return null
  const next = new Set(seen).add(node)
  if (node.type === 'Literal') return [node.value]
  if (node.type === 'TemplateLiteral' && !node.expressions.length) return [node.quasis[0].value.cooked]
  if (node.type === 'ConditionalExpression') {
    const a = values(node.consequent, context, next), b = values(node.alternate, context, next)
    return a && b ? [...a, ...b] : null
  }
  if (node.type === 'Identifier') {
    let scope = context.sourceCode.getScope(node)
    while (scope) {
      const variable = scope.set.get(node.name)
      if (variable) {
        const def = variable.defs[0]
        if (variable.references.some((ref) => { let use = ref.identifier.parent; while (use?.type === 'MemberExpression') use = use.parent; return use?.type === 'AssignmentExpression' || use?.type === 'UpdateExpression' })) return null
        if (def?.node?.type !== 'VariableDeclarator' || def.parent?.kind !== 'const' || variable.references.some((ref) => ref.isWrite() && !ref.init)) return null
        if (unwrap(def.node.init)?.type === 'ObjectExpression' && variable.references.some((ref) => {
          if (ref.init) return false
          // Object identity must never escape: calls and aliases may mutate it.
          let use = ref.identifier
          while (use.parent?.type === 'MemberExpression' && use.parent.object === use) use = use.parent
          return use.parent?.type !== 'JSXExpressionContainer'
        })) return null
        return values(def.node.init, context, next)
      }
      scope = scope.upper
    }
  }
  if (node.type === 'ObjectExpression') {
    const result = []
    for (const prop of node.properties) {
      if (prop.type !== 'Property' || prop.computed || prop.method) return null
      const val = values(prop.value, context, next)
      if (!val) return null
      result.push(...val)
    }
    return result
  }
  if (node.type === 'MemberExpression') return values(node.object, context, next)
  return null
}

function valid(value, category, prop) {
  if (category === 'geometry') return contract.geometry[prop].includes(value)
  const approved = category === 'colors' ? colors : contract[category]
  if (typeof value === 'number') return Array.isArray(approved) && approved.includes(value)
  if (typeof value !== 'string') return false
  // Token-bearing props have single-token payloads. Reject CSS functions/multiword literals.
  return value.split(/\s+/).every((clause) => {
    const token = clause.split(':').at(-1)
    if (Array.isArray(approved)) return approved.includes(token)
    if (Object.hasOwn(approved, token)) return true
    if (category === 'size' && Object.hasOwn(contract.space, token)) return true
    return ['space', 'size'].includes(category) && (token === 'auto' || /^(?:\d+(?:\.\d+)?%|100[ds]?vh)$/.test(token))
  })
}

function rule(kind) {
  return {
    meta: { type: 'problem', schema: [] },
    create(context) {
      function check(prop, value, node) {
        if (!['semantic-colors', 'token-values'].includes(kind)) return
        const category = categories.get(prop)
        if ((kind === 'semantic-colors' && category !== 'colors') || (kind === 'token-values' && (!category || category === 'colors'))) return
        const resolved = values(value, context)
        if (!resolved || !resolved.length || !resolved.every((v) => valid(v, category, prop))) context.report({ node, message: `${prop} must use approved ${category} values from design/contract.json; use a literal token or a statically verifiable const/conditional.` })
      }
      function escape(prop, value, node) {
        if (kind !== 'no-style-escape') return
        if (prop === 'style') {
          // Tamagui 3.3 excludes table display modes from its typed display prop.
          const obj = unwrap(value)
          if (obj?.type === 'ObjectExpression' && obj.properties.length === 1 && nameOf(obj.properties[0].key) === 'display' && /^(table|table-cell|table-column|table-column-group|table-row|table-row-group|table-header-group)$/.test(obj.properties[0].value.value ?? '')) return
        }
        if (['style', 'className', 'css', 'dangerouslySetInnerHTML', 'backgroundImage', 'boxShadow', 'textShadow', 'filter', 'backdropFilter', 'border', 'borderBlock', 'borderInline', 'borderTop', 'borderBottom', 'borderLeft', 'borderRight', 'borderBlockStart', 'borderBlockEnd', 'borderInlineStart', 'borderInlineEnd', 'outline'].includes(prop)) context.report({ node, message: `Use Tamagui props instead of ${prop}. Only the table display compatibility adapter is allowed.` })
      }
      return {
        JSXOpeningElement(node) {
          if (kind === 'no-style-escape' && ['style', 'link'].includes(nameOf(node.name))) context.report({ node, message: 'Use the approved generated stylesheet imports, not style/link elements.' })
        },
        JSXAttribute(node) {
          const prop = nameOf(node.name)
          const value = node.value?.type === 'JSXExpressionContainer' ? node.value.expression : node.value
          check(prop, value, node); escape(prop, value, node)
        },
        Property(node) { if (node.parent.type === 'ObjectPattern') return; if (node.computed && kind === 'no-style-escape') context.report({ node, message: 'Use explicit property names in UI objects so design values can be checked.' }); check(nameOf(node.key), node.value, node); escape(nameOf(node.key), node.value, node) },
        JSXSpreadAttribute(node) {
          if (kind !== 'no-style-escape') return
          if (unwrap(node.argument)?.type !== 'ObjectExpression') context.report({ node, message: 'Expand JSX spreads into explicit props so design values can be checked.' })
        },
        SpreadElement(node) {
          if (kind === 'no-style-escape' && node.parent.type === 'ObjectExpression') context.report({ node, message: 'Expand object spreads in UI source so design values can be checked.' })
        },
        ImportDeclaration(node) {
          if (kind === 'no-css-imports' && /\.(css|scss|sass|less)(?:[?#]|$)/.test(node.source.value) && !['@tamagui/core/reset.css', './tamagui.generated.css'].includes(node.source.value)) context.report({ node, message: 'Only the Tamagui reset and generated CSS may be imported.' })
        },
        ImportExpression(node) {
          if (kind === 'no-css-imports') context.report({ node, message: 'Dynamic imports in UI source require review; use static imports so stylesheet policy is enforceable.' })
        },
        CallExpression(node) {
          if (kind === 'no-style-escape' && node.callee.type === 'Identifier') {
            let scope = context.sourceCode.getScope(node)
            while (scope) {
              const binding = scope.set.get(node.callee.name)
              if (binding) {
                if (binding.defs.some((def) => def.node.type === 'ImportSpecifier' && def.node.imported.name === 'styled') && unwrap(node.arguments[1])?.type !== 'ObjectExpression') context.report({ node, message: 'Declare styled options inline so the complete style recipe is checked.' })
                break
              }
              scope = scope.upper
            }
          }
          if (kind === 'no-style-escape' && ['insertRule', 'replaceSync', 'setProperty'].includes(nameOf(node.callee.property))) context.report({ node, message: 'Do not inject CSS; use Tamagui props.' })
        },
      }
    },
  }
}
export default { meta: { name: 'design' }, rules: Object.fromEntries(['semantic-colors', 'token-values', 'no-style-escape', 'no-css-imports'].map((name) => [name, rule(name)])) }
