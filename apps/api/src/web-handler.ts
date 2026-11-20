import { Layer } from "effect";
import { HttpRouter } from "effect/http";
import { boxscoreArchive } from "virtual:boxscore-archive";
import { insightsArchive } from "virtual:insights-archive";

import season from "../../../data/nhl-20262027.json" with { type: "json" };
import poster from "../../../data/nhl-poster-20262027.json" with { type: "json" };
import { loggerLayer } from "../../../lib/logger.mjs";
import { BoxScores } from "./boxscores.ts";
import { archiveInsights, loadPublishedInsights } from "./insights.ts";
import { ApiRoutes } from "./routes.ts";
import { Snapshots } from "./snapshots.ts";

export const webApi = HttpRouter.toWebHandler(
  ApiRoutes.pipe(
    Layer.provide([
      Snapshots.layerData({
        season,
        poster,
        insights: loadPublishedInsights(
          archiveInsights(insightsArchive),
          season.teams.map((team) => team.abbrev)
        ),
      }),
      BoxScores.layerArchive(boxscoreArchive),
    ]),
    Layer.provideMerge(loggerLayer)
  )
);

export default { fetch: webApi.handler };
