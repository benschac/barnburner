import { defineCollection, defineConfig, defineParser } from '@content-collections/core'
import { compileMDX } from '@content-collections/mdx'
import { MDXContent } from '@content-collections/mdx/react'
import { Result, Schema } from 'effect'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import remarkGfm from 'remark-gfm'
import { parseAnalystPlan } from './plan-viewer/plan.ts'

const analystPlans = defineCollection({
  name: 'analystPlans',
  directory: '../../docs',
  include: 'analyst-agent-plan.md',
  parser: defineParser((content) => ({ content })),
  schema: Schema.toStandardSchemaV1(Schema.Struct({ content: Schema.String })),
  transform: async (document, context) => {
    const parsed = parseAnalystPlan(document.content)
    // defect: content-collections reports a failed transform only through a thrown error
    if (Result.isFailure(parsed)) throw parsed.failure
    const plan = parsed.success
    const renderMdx = async (content: string) => {
      const code = await compileMDX(context, { ...document, content }, { remarkPlugins: [remarkGfm] })
      return renderToStaticMarkup(createElement(MDXContent, { code }))
    }
    const tasks = await Promise.all(plan.tasks.map(async (task) => ({ ...task, bodyHtml: await renderMdx(task.body) })))
    const contracts = await Promise.all(plan.contracts.map(async (contract) => ({ ...contract, bodyHtml: await renderMdx(contract.body) })))
    const decisions = await Promise.all(plan.decisions.map(async (decision) => ({
      ...decision,
      decisionHtml: await renderMdx(decision.decision),
      reasonHtml: await renderMdx(decision.reason),
    })))
    return {
      ...plan, tasks, contracts, decisions,
      recordHtml: await renderMdx(plan.record),
      routingHtml: await renderMdx(plan.routing),
      sourceFile: document._meta.fileName,
    }
  },
})

export default defineConfig({ content: [analystPlans] })
