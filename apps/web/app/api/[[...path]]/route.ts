import handler from "@nhl-reddit-stats/api/web-handler";

// Unknown /api paths get the API's own JSON 404 (or 405) instead of falling through to the poster's catch-all page, served from the Node runtime and never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = (request: Request): Promise<Response> =>
  handler.fetch(request);
export const POST = (request: Request): Promise<Response> =>
  handler.fetch(request);
