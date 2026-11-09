export default {
  meta: { name: 'patterns' },
  rules: {
    'no-module-mutable-state': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        return {
          VariableDeclaration(node) {
            const parent = node.parent?.type === 'ExportNamedDeclaration' ? node.parent.parent : node.parent
            if (node.kind !== 'const' && parent?.type === 'Program') {
              context.report({ node, message: 'Module-level mutable bindings share state across actor lifetimes. Fix: keep mutable state inside the owning actor or function.' })
            }
          },
        }
      },
    },
  },
}
