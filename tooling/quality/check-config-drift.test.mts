import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import { descriptor } from "./check-config-drift.mts";

describe("check:config-drift", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("pins the system and promotion gate scripts", () => {
    const packageRequirement = descriptor.requirements.find(
      ({ file }) => file === "package.json",
    );

    expect(packageRequirement?.includes).toEqual(
      expect.arrayContaining([
        "check:system-catalog",
        "check:system-topology",
        "check:data-resources",
        "check:promotion-boundary",
      ]),
    );
  });

  it("keeps typed product-contract and runtime acceptance as root authority", () => {
    const root = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      readonly scripts: Readonly<Record<string, string>>;
      readonly devDependencies: Readonly<Record<string, string>>;
    };
    expect(root.scripts.verify).toContain("pnpm check:product-contract");
    expect(root.scripts.verify).toContain("pnpm acceptance:required");
    const retiredRunner = ["cu", "cumber"].join("");
    expect(root.devDependencies).not.toHaveProperty(
      `@${retiredRunner}/${retiredRunner}`,
    );
    expect(root.devDependencies?.["@playwright/test"]).toBe("1.61.1");
  });
});
