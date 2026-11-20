import { createHash } from "node:crypto";
import { inspect } from "node:util";

import type { TeamPosterData } from "../src/stats.ts";
import { socialImageSize } from "./card.ts";

// Reads SITE_URL, VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL and VERCEL_ENV. An index signature accepts both
// Node's ProcessEnv and Next's, which also requires NODE_ENV.
export type SiteEnv = { readonly [key: string]: string | undefined };

export function siteOrigin(env: SiteEnv) {
  const host =
    env.SITE_URL ??
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ??
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:5173");
  const url = new URL(host);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "SITE_URL must be an HTTP(S) origin, such as https://example.com"
    );
  }
  return url.origin;
}

export function socialImageOrigin(env: SiteEnv) {
  return env.VERCEL_ENV === "preview" && env.VERCEL_URL
    ? siteOrigin({ VERCEL_URL: env.VERCEL_URL })
    : siteOrigin(env);
}

export function socialDescription(data: TeamPosterData) {
  const summary = data.seasonSummary;
  return `${summary.record} · ${summary.points} points · ${summary.divisionPlace} in the ${data.team.division} · ${summary.streak}. Last 10: ${summary.lastTen}. Through ${data.snapshotDate}.`;
}

/** Short hash of everything the card draws, so the image URL changes when the card does. */
export function cardVersion(data: TeamPosterData) {
  return createHash("sha256")
    .update(inspect(data, { depth: null, sorted: true }))
    .digest("hex")
    .slice(0, 16);
}

/** Title, description, canonical URL, Open Graph and Twitter tags for one team page. Shaped like Next's Metadata. */
export function teamMetadata(
  data: TeamPosterData,
  origin: string,
  {
    path,
    imagePath,
    imageOrigin = origin,
    version,
  }: { path: string; imagePath: string; imageOrigin?: string; version?: string }
) {
  const title = `${data.team.name} | ${data.seasonSummary.record} | RinkSide`;
  const description = socialDescription(data);
  const url = new URL(path, origin).href;
  const image = new URL(
    version ? `${imagePath}?v=${version}` : imagePath,
    imageOrigin
  ).href;
  const alt = `${data.team.name} season at a glance. ${description}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website" as const,
      siteName: "RinkSide",
      title,
      description,
      url,
      images: [
        {
          url: image,
          type: "image/png",
          width: socialImageSize.width,
          height: socialImageSize.height,
          alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [{ url: image, alt }],
    },
  };
}
