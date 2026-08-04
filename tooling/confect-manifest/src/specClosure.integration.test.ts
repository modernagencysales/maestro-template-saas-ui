import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sha256 = (source: Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(source).digest("hex")}`;
const ROOT = resolve("../..");
const operationIdsIn = (source: string): readonly string[] =>
  [...source.matchAll(/\boperationId:\s*"([^"]+)"/gu)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );

describe("generated Confect inventory sidecar", () => {
  it("records the exact reviewed 8-to-22 operation delta without changing runtime", () => {
    const digestPath = resolve(
      ROOT,
      "packages/convex/confect/_generated/confectManifest.inventory.digest.json",
    );
    const digest = JSON.parse(readFileSync(digestPath, "utf8")) as {
      readonly runtimeOperationIds: readonly string[];
      readonly inventoryOperationIds: readonly string[];
      readonly addedOperationIds: readonly string[];
      readonly removedOperationIds: readonly string[];
      readonly sourceSpecs: readonly { readonly path: string }[];
      readonly outputs: readonly {
        readonly path: string;
        readonly sha256: `sha256:${string}`;
      }[];
    };

    const runtimeOperationIds = operationIdsIn(
      readFileSync(
        resolve(
          ROOT,
          "packages/template-core/src/generated/confectManifest.ts",
        ),
        "utf8",
      ),
    );
    const inventoryOperationIds = operationIdsIn(
      readFileSync(
        resolve(
          ROOT,
          "packages/convex/confect/_generated/confectManifest.inventory.ts",
        ),
        "utf8",
      ),
    );
    expect(runtimeOperationIds).toHaveLength(8);
    expect(inventoryOperationIds).toHaveLength(22);
    expect(digest.runtimeOperationIds).toEqual(runtimeOperationIds);
    expect(digest.inventoryOperationIds).toEqual(inventoryOperationIds);
    expect(digest.addedOperationIds).toEqual([
      "capabilities._versions.publicationEcho.v1.run",
      "workflows.generateCompleteBuildPack.approve",
      "workflows.generateCompleteBuildPack.start",
      "workflows.generateCompleteBuildPack.status",
      "workflows.publicationFixture.cancel",
      "workflows.publicationFixture.cleanup",
      "workflows.publicationFixture.list",
      "workflows.publicationFixture.listByName",
      "workflows.publicationFixture.listSteps",
      "workflows.publicationFixture.restart",
      "workflows.publicationFixture.sendEvent",
      "workflows.publicationFixture.startInteractive",
      "workflows.publicationFixture.startQueued",
      "workflows.publicationFixture.status",
    ]);
    expect(digest.removedOperationIds).toEqual([]);
    expect(digest.sourceSpecs.map(({ path }) => path)).toEqual(
      [...digest.sourceSpecs.map(({ path }) => path)].sort(),
    );
    for (const output of digest.outputs)
      expect(output.sha256).toBe(
        sha256(readFileSync(resolve(ROOT, output.path))),
      );
  });

  it("remains controller-only and absent from runtime consumers", () => {
    for (const path of [
      "packages/convex/confect/http.ts",
      "packages/convex/confect/manifest/executor.ts",
      "packages/convex/confect/manifest/openapi.ts",
      "packages/convex/confect/manifest/mcp.ts",
      "apps/cli/src/index.ts",
      "tooling/workflow/src/index.ts",
    ])
      expect(readFileSync(resolve(ROOT, path), "utf8"), path).not.toContain(
        "confectManifest.inventory",
      );
  });
});
