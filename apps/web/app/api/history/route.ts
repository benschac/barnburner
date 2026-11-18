import handler from '@nhl-reddit-stats/api/history-handler'

// Same handler as apps/web/api/history.ts on Vercel, served from the Node runtime and never cached.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const GET = (request: Request): Promise<Response> => handler.fetch(request)
export const POST = (request: Request): Promise<Response> => handler.fetch(request)
