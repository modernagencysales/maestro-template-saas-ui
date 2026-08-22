import { readFileSync } from "node:fs";

import type { AppMapBuildInputV1 } from "./schema";

export const readFixture = (name: string): AppMapBuildInputV1 =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"),
  ) as AppMapBuildInputV1;
