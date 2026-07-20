import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import { descriptor } from "./check-ci-completeness.mts";

describe("check:ci-completeness", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("pins topology, lifecycle, and promotion enforcement in every required lane", () => {
    const requirements = JSON.stringify(descriptor.requirements);

    expect(requirements).toContain("check:system-topology");
    expect(requirements).toContain("check:data-resources");
    expect(requirements).toContain("check:promotion-boundary");
    expect(requirements).toContain(".github/workflows/quality.yml");
    expect(requirements).toContain("Justfile");
    expect(requirements).toContain("lefthook.yml");
  });
});
