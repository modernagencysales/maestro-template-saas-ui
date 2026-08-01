import { describe, expect, it } from "vitest";

import { mapBuildPackToMaestro, validateWorkPackage } from "./maestroMapping";

describe("honest Maestro mapping", () => {
  it("never recommends a planned blueprint as executable", () => {
    const mapping = mapBuildPackToMaestro({
      blueprint: {
        id: "implementation-consulting-brain",
        status: "planned",
      },
      fitScore: 82,
      purchaseCreditCents: 2_900,
      gaps: [],
    });

    expect(mapping.primaryAction).toBe("review-planned-blueprint");
    expect(mapping.primaryAction).not.toBe("start-building");
  });

  it("suppresses the template offer when fit is low", () => {
    expect(
      mapBuildPackToMaestro({
        blueprint: { id: "saas", status: "implemented" },
        fitScore: 35,
        purchaseCreditCents: 2_900,
        gaps: ["native mobile"],
      }).primaryAction,
    ).toBe("take-spec-elsewhere");
  });

  it("requires a backlog and resolution path for template gaps", () => {
    expect(() =>
      validateWorkPackage({ kind: "template-gap", target: "native mobile" }),
    ).toThrow("resolution path");
  });
});
