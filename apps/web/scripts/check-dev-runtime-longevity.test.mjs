import assert from "node:assert/strict";
import { createServer } from "node:net";
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
  const result = await checkDevRuntimeLongevity({
    cwd: repositoryRoot,
    webPort,
    longevityMs: 125_000,
  });

  assert.equal(result.healthBefore, 200, result.logs);
  assert.equal(result.healthAfter, 200, result.logs);
  assert.equal(result.cleanShutdown, true, result.logs);
}, 240_000);
