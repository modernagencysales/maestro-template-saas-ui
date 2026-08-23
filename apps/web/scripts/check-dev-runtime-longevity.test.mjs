import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

import { checkDevRuntimeLongevity } from "./check-dev-runtime-longevity.mjs";

const repositoryRoot = fileURLToPath(
  new globalThis.URL("../../..", import.meta.url),
);

const allocateLoopbackPort = async () => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    throw new Error("Loopback port allocation failed.");
  }
  const { port } = address;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
};

test("browser navigation leaves the supervised dev runtime healthy", async () => {
  const webPort = await allocateLoopbackPort();
  const routeTreePath = resolve(
    repositoryRoot,
    "apps/web/src/routeTree.gen.ts",
  );
  const routeTreeBefore = readFileSync(routeTreePath, "utf8");
  const receipt = JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "docs/template/saas-ui-starter-files.json"),
      "utf8",
    ),
  );
  const expectedRouteTreeHash = receipt.files.find(
    ({ destination }) => destination === "apps/web/src/routeTree.gen.ts",
  )?.sha256;
  assert.equal(
    createHash("sha256").update(routeTreeBefore).digest("hex"),
    expectedRouteTreeHash,
  );
  const result = await checkDevRuntimeLongevity({
    cwd: repositoryRoot,
    webPort,
    longevityMs: 125_000,
  });

  assert.equal(result.healthBefore, 200, result.logs);
  assert.equal(result.healthAfter, 200, result.logs);
  assert.equal(result.cleanShutdown, true, result.logs);
  assert.deepEqual(result.checkedRoutes, ["/records", "/acme"]);
  assert.deepEqual(result.checkedViewports, ["desktop", "mobile"]);
  assert.equal(readFileSync(routeTreePath, "utf8"), routeTreeBefore);
}, 240_000);
