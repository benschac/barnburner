import { TeamData } from "@nhl-reddit-stats/season";
import { Config, Effect, Schema } from "effect";
import type { Metadata } from "next";
import { headers } from "next/headers";

import season from "../../../../data/nhl-20262027.json" with { type: "json" };
import poster from "../../../../data/nhl-poster-20262027.json" with { type: "json" };
import {
  cardVersion,
  siteOrigin,
  socialImageOrigin,
  teamMetadata,
} from "../../social/metadata.ts";
import { teamPoster } from "../../src/stats.ts";
import { teamFromPath, teamHref } from "../../src/team-season.ts";
import PosterPage from "./Poster";

const snapshots = Schema.decodeUnknownSync(TeamData)({ season, poster });
const nodeEnvironment = Config.String("NODE_ENV").pipe(Config.withDefault(""));
const configured = (env: NodeJS.ProcessEnv) =>
  Boolean(env.SITE_URL ?? env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL);

// Configured hosts win; with none set, use the host this request arrived on.
async function requestOrigins() {
  if (configured(process.env))
    return {
      origin: siteOrigin(process.env),
      imageOrigin: socialImageOrigin(process.env),
    };
  const incoming = await headers();
  const host =
    incoming.get("x-forwarded-host") ??
    incoming.get("host") ??
    "localhost:3000";
  const origin = siteOrigin({
    SITE_URL: `${incoming.get("x-forwarded-proto") ?? "http"}://${host}`,
  });
  return { origin, imageOrigin: origin };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug = [] } = await params;
  const path = `/${slug.join("/")}`;
  const team = teamFromPath(path) ?? "NJD";
  const data = teamPoster(snapshots, team);
  // The image route fingerprints a rendered PNG, which needs resvg's native binding that the bundler cannot bundle.
  // The Next page names the PNG path (served by FN5) and versions it by the card's data instead.
  const { origin, imageOrigin } = await requestOrigins();
  return teamMetadata(data, origin, {
    path: path === "/" ? "/" : teamHref(team),
    imagePath: `/og/${team}.png`,
    imageOrigin,
    version: cardVersion(data),
  });
}

export default function Page() {
  const nodeEnv = Effect.runSync(nodeEnvironment);
  return <PosterPage showGraphLab={nodeEnv === "development"} />;
}
