import { FinalsTables } from "@nhl-reddit-stats/viz";
import { Schema } from "effect";

import { readExportFile } from "./export-file";

/** Reads and decodes one picked finals file. */
export const loadFinalsFile = readExportFile(
  "finals",
  Schema.Struct({ tables: FinalsTables, notes: Schema.String })
);
