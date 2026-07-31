import { describe, expect, it } from "vitest";
import { compareGeneratedSnapshots } from "./check-convex-generation.mts";

describe("check:convex generation freshness", () => {
  it("accepts byte-identical generated output", () => {
    const reviewed = {
      "confect/_generated/schema.ts": "sha256:reviewed",
      "convex/_generated/api.d.ts": "sha256:api",
    };

    expect(compareGeneratedSnapshots(reviewed, { ...reviewed })).toEqual([]);
  });

  it("reports only drift introduced by this invocation", () => {
    expect(
      compareGeneratedSnapshots(
        {
          "confect/_generated/schema.ts": "sha256:reviewed-dirty",
          "convex/_generated/api.d.ts": "sha256:api",
        },
        {
          "confect/_generated/schema.ts": "sha256:new-drift",
          "convex/_generated/api.d.ts": "sha256:api",
          "convex/_generated/server.d.ts": "sha256:new-file",
        },
      ),
    ).toEqual([
      "confect/_generated/schema.ts",
      "convex/_generated/server.d.ts",
    ]);
  });

  it("reports removed generated files", () => {
    expect(
      compareGeneratedSnapshots(
        { "confect/_generated/schema.ts": "sha256:before" },
        {},
      ),
    ).toEqual(["confect/_generated/schema.ts"]);
  });
});
