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
});
