import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import { descriptor } from "./check-knip.mts";

describe("check:knip", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("requires a real knip config and executable script", () => {
    expect(descriptor.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "knip.json",
          includes: expect.arrayContaining(["entry", "project"]),
        }),
        expect.objectContaining({
          file: "package.json",
          includes: expect.arrayContaining(["knip --config knip.json"]),
        }),
      ]),
    );
  });

  it("keeps the canonical UI shelves reachable for dependency analysis", () => {
    const config = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../knip.json"), "utf8"),
    ) as {
      readonly ignoreDependencies?: readonly string[];
      readonly workspaces: Readonly<
        Record<
          string,
          {
            readonly entry?: readonly string[];
            readonly ignoreDependencies?: readonly string[];
          }
        >
      >;
    };

    expect(config.workspaces["apps/web"]?.entry).toContain(
      "src/components/**/*.{ts,tsx}",
    );
    expect(config.workspaces["apps/web"]?.entry).toContain(
      "src/features/**/*.{ts,tsx}",
    );
    expect(config.workspaces["packages/ui"]?.entry).toContain("src/*/index.ts");
    expect(config.workspaces["apps/web"]?.ignoreDependencies).toContain(
      "@confect/react",
    );
    expect(config.ignoreDependencies).not.toContain("@confect/react");
  });
});
