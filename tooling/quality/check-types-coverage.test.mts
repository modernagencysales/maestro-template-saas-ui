import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import { descriptor } from "./check-types-coverage.mts";

describe("check:types-coverage", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("requires a real type-coverage command with an explicit threshold", () => {
    expect(descriptor.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "package.json",
          includes: expect.arrayContaining([
            "tsx tooling/quality/run-type-coverage.mts",
          ]),
        }),
        expect.objectContaining({
          file: "tooling/quality/run-type-coverage.mts",
          includes: expect.arrayContaining([
            'import.meta.resolve("type-coverage/bin/type-coverage")',
            "--max-old-space-size=8192",
            "--at-least",
            '"99.7"',
            "--ignore-files",
            "verifiedImmutableReceiptPaths",
          ]),
        }),
        expect.objectContaining({
          file: "tsconfig.type-coverage.json",
          includes: expect.arrayContaining([
            "include",
            "exclude",
            "**/*.test.*",
            "**/*.spec.*",
            "**/__tests__/**",
            "packages/convex/test/**",
            "tests/**",
            "tooling/agent-pack/evals/runs/**",
          ]),
        }),
        expect.objectContaining({
          file: "docs/template/type-coverage-ratchet.md",
          includes: expect.arrayContaining([
            "99.7",
            "100%",
            "source-only",
            "strict TypeScript",
          ]),
        }),
      ]),
    );
  });
});
