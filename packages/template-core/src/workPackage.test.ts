import { describe, expect, it } from "vitest";

import { validateWorkPackage } from "./workPackage";

describe("WorkPackage", () => {
  it("validates every work package kind", () => {
    expect(
      validateWorkPackage({
        kind: "pattern-instance",
        target: " billing ",
        generatorCommand: " pnpm template:add-billing ",
        followUpGates: [" billing contract "],
      }),
    ).toEqual({
      kind: "pattern-instance",
      target: "billing",
      generatorCommand: "pnpm template:add-billing",
      followUpGates: ["billing contract"],
    });
    expect(
      validateWorkPackage({
        kind: "fixture-to-real",
        target: "billing",
        persistenceOrProviderBoundary: "Dodo adapter",
        followUpGates: ["billing integration"],
      }).kind,
    ).toBe("fixture-to-real");
    expect(
      validateWorkPackage({
        kind: "template-gap",
        target: "native mobile",
        templateBacklogRef: "MAESTRO-GAP-17",
        templateResolutionPath: "Deliver to a native agency",
        followUpGates: ["mobile acceptance"],
      }).kind,
    ).toBe("template-gap");
  });

  it("rejects blank, malformed, and excess work package fields", () => {
    expect(() =>
      validateWorkPackage({
        kind: "pattern-instance",
        target: "billing",
        generatorCommand: " ",
        followUpGates: ["gate"],
      }),
    ).toThrow();
    expect(() =>
      validateWorkPackage({
        kind: "pattern-instance",
        target: "billing",
        generatorCommand: "generate",
        followUpGates: [],
      }),
    ).toThrow();
    expect(() =>
      validateWorkPackage({
        kind: "pattern-instance",
        target: "billing",
        generatorCommand: "generate",
        followUpGates: ["gate"],
        unexpected: true,
      }),
    ).toThrow();
  });
});
