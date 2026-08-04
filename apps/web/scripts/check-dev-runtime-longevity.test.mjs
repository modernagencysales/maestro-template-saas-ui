import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

import { checkDevRuntimeLongevity } from "./check-dev-runtime-longevity.mjs";

const repositoryRoot = fileURLToPath(
  new globalThis.URL("../../..", import.meta.url),
);

test("browser navigation leaves the supervised dev runtime healthy", async () => {
  const result = await checkDevRuntimeLongevity({
    cwd: repositoryRoot,
    webPort: 15183,
    longevityMs: 125_000,
  });

  assert.equal(result.healthBefore, 200, result.logs);
  assert.equal(result.healthAfter, 200, result.logs);
  assert.equal(result.cleanShutdown, true, result.logs);
}, 240_000);
