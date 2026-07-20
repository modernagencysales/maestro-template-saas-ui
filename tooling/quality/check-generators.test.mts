import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import { descriptor } from "./check-generators.mts";

describe("check:generators", () => {
  it("labels the gate as shape-only because behavior lives in generator tests", () => {
    expect(descriptor.name).toBe("check:generators (shape-only)");
  });

  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("guards blueprint-first factory contracts", () => {
    expect(descriptor.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "docs/template/blueprint-catalog.md",
          includes: expect.arrayContaining([
            "source-grounded-gtm-brain",
            "implementation-consulting-brain",
            "internal-ops-agent-workspace",
            "custom-domain-ai-app",
          ]),
        }),
        expect.objectContaining({
          file: "docs/template/generator-output-contract.md",
          includes: expect.arrayContaining([
            "Confect spec/impl",
            "Effect schema",
            "typed errors",
            "generated manifest/headless metadata",
            "explicit generated ref mappings",
          ]),
          absent: expect.arrayContaining(["headless registry entry"]),
        }),
        expect.objectContaining({
          file: "package.json",
          includes: expect.arrayContaining([
            "template:quickstart",
            "template:seed-demo",
            "template:handoff",
            "template:add-client-domain",
            "template:systems",
            "template:prototype",
            "template:add-feature",
            "check:system-catalog",
          ]),
        }),
      ]),
    );
  });
});
