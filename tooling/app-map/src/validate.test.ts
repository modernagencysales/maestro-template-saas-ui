import { describe, expect, it } from "vitest";

import { buildAppMap } from "./build";
import type { AppMapBuildInputV1, AppMapDiagnosticCode } from "./schema";
import { readFixture } from "./test-fixtures";

const expectedFailures: readonly [string, AppMapDiagnosticCode][] = [
  ["dangling", "APP_MAP_DANGLING_EDGE"],
  ["unowned", "APP_MAP_UNOWNED_NODE"],
  ["parallel-authority", "APP_MAP_PARALLEL_AUTHORITY"],
  ["stale", "APP_MAP_STALE_FACT"],
];

describe("App Map validation", () => {
  it.each(expectedFailures)(
    "fails closed for the %s fixture with an actionable diagnostic",
    (fixture, code) => {
      const result = buildAppMap(readFixture(fixture));

      expect(result.ok).toBe(false);
      if (result.ok) return;

      const diagnostic = result.diagnostics.find(
        (candidate) => candidate.code === code,
      );
      expect(diagnostic).toMatchObject({
        code,
        rerun: "pnpm check:app-map",
      });
      expect(diagnostic?.factId.length).toBeGreaterThan(0);
      expect(diagnostic?.repair.length).toBeGreaterThan(20);
    },
  );

  it("rejects a node whose canonical provenance is absent", () => {
    const input = readFixture("valid");
    const firstBatch = input.batches[0];
    const firstNode = firstBatch?.nodes[0];
    expect(firstBatch).toBeDefined();
    expect(firstNode).toBeDefined();
    if (!firstBatch || !firstNode) return;

    const invalid = {
      ...input,
      batches: [
        {
          ...firstBatch,
          nodes: [{ ...firstNode, provenance: undefined }],
        },
        ...input.batches.slice(1),
      ],
    } as unknown as AppMapBuildInputV1;
    const result = buildAppMap(invalid);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "APP_MAP_INVALID_FACT",
        factId: "system:access-and-tenancy",
        rerun: "pnpm check:app-map",
      }),
    );
  });
});
