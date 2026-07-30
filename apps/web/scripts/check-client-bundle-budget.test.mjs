import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CLIENT_CHUNK_BUDGET_BYTES,
  inspectClientBundleDirectory,
} from "./check-client-bundle-budget.mjs";

test("accepts JavaScript chunks at the client bundle budget", async () => {
  const root = await mkdtemp(join(tmpdir(), "maestro-client-bundle-"));

  try {
    await mkdir(join(root, "assets"));
    await writeFile(
      join(root, "assets", "within-budget.js"),
      Buffer.alloc(CLIENT_CHUNK_BUDGET_BYTES),
    );
    await writeFile(
      join(root, "assets", "large-source-map.js.map"),
      Buffer.alloc(CLIENT_CHUNK_BUDGET_BYTES + 1),
    );

    assert.deepEqual(await inspectClientBundleDirectory(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports every JavaScript chunk over the client bundle budget", async () => {
  const root = await mkdtemp(join(tmpdir(), "maestro-client-bundle-"));

  try {
    await mkdir(join(root, "assets", "nested"), { recursive: true });
    await writeFile(
      join(root, "assets", "nested", "oversized.js"),
      Buffer.alloc(CLIENT_CHUNK_BUDGET_BYTES + 1),
    );

    assert.deepEqual(await inspectClientBundleDirectory(root), [
      {
        bytes: CLIENT_CHUNK_BUDGET_BYTES + 1,
        path: "assets/nested/oversized.js",
      },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
