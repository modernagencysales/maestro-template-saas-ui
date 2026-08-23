import { describe, expect, it } from "vitest";

import { validateWorkPackage } from "./workPackage";

const frontend = {
  screenCatalogId:
    "starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx",
  sourceReceipt: "docs/template/saas-ui-starter-files.json",
  shellId: "app-shell",
  allowedAdaptations: ["route-binding", "data-adapter"],
  requiredVisualStates: [
    "loading",
    "empty",
    "error",
    "populated",
    "selected",
    "mutation",
  ],
} as const;

describe("WorkPackage", () => {
  it("validates every work package kind", () => {
    expect(
      validateWorkPackage({
        kind: "pattern-instance",
        target: " billing ",
        generatorCommand: " pnpm template:add-billing ",
        followUpGates: [" billing contract "],
        frontend,
      }),
    ).toEqual({
      kind: "pattern-instance",
      target: "billing",
      generatorCommand: "pnpm template:add-billing",
      followUpGates: ["billing contract"],
      frontend,
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

  it("requires complete, normalized frontend authority when present", () => {
    expect(
      validateWorkPackage({
        kind: "pattern-instance",
        target: "clients",
        generatorCommand: "pnpm template:add-feature",
        followUpGates: ["visual acceptance"],
        frontend,
      }).frontend,
    ).toEqual(frontend);
    expect(() =>
      validateWorkPackage({
        kind: "pattern-instance",
        target: "clients",
        generatorCommand: "pnpm template:add-feature",
        followUpGates: ["visual acceptance"],
        frontend: {
          ...frontend,
          requiredVisualStates: ["loading", "empty"],
        },
      }),
    ).toThrow();
    expect(() =>
      validateWorkPackage({
        kind: "pattern-instance",
        target: "clients",
        generatorCommand: "pnpm template:add-feature",
        followUpGates: ["visual acceptance"],
        frontend: { ...frontend, extra: "hand-built" },
      }),
    ).toThrow();
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
