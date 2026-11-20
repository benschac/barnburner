// Same handler as apps/web/api/poster.ts on Vercel, served from the Node runtime and never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Turbopack bundles a workspace package whose symlink resolves outside node_modules, even when serverExternalPackages lists it. The turbopackIgnore comment keeps this a runtime import of apps/api/dist, which holds the box-score chunks.
const loadHandler = async () =>
  (
    await import(
      /* turbopackIgnore: true */ "@nhl-reddit-stats/api/web-handler"
    )
  ).default;

export const GET = async (request: Request): Promise<Response> => {
  const handler = await loadHandler();
  return await handler.fetch(request);
};
export const POST = async (request: Request): Promise<Response> => {
  const handler = await loadHandler();
  return await handler.fetch(request);
};
