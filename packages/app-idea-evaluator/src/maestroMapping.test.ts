import { describe, expect, it } from "vitest";

import {
  mapBuildPackToMaestro,
  mapCompleteBuildPackToMaestro,
  validateWorkPackage,
} from "./maestroMapping";

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
        blueprint: { id: "saas-application", status: "implemented" },
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

  it("rejects empty gates and blank executable instructions", () => {
    expect(() =>
      validateWorkPackage({
        kind: "pattern-instance",
        target: "account settings",
        generatorCommand: " ",
        followUpGates: [],
      }),
    ).toThrow();
    expect(() =>
      validateWorkPackage({
        kind: "template-gap",
        target: "native mobile",
        templateBacklogRef: " ",
        templateResolutionPath: "Build a supported mobile surface",
        followUpGates: ["mobile contract"],
      }),
    ).toThrow();
  });

  it("produces a portable, catalog-grounded implementation handoff", () => {
    const mapping = mapCompleteBuildPackToMaestro({
      pack: {
        productBrief: "Fill cancelled dental appointments.",
        customerAndProblem: "Dental practices lose chair revenue.",
        scope: ["Waitlist matching"],
        requirements: ["Notify eligible patients"],
        userJourneys: ["Operator fills a cancellation"],
        dataModel: ["Practice — tenant account", "Appointment — open chair"],
        architecture: "Tenant-aware web application",
        integrations: ["Postmark"],
        securityAndPrivacy: ["Tenant isolation"],
        deliveryPlan: ["Pilot"],
        acceptanceCriteria: ["Fill one cancellation"],
        risks: ["Consent"],
        openQuestions: [],
        competitorClaims: [],
      },
      fitScore: 81,
      purchaseCreditCents: 2_900,
      blueprint: { id: "saas-application", status: "implemented" },
      catalog: [
        {
          target: "notifications",
          status: "implemented",
          generatorCommand: "pnpm template:add-notifications --write",
          followUpGates: ["notifications contract"],
        },
      ],
      gaps: [],
    });

    expect(mapping.domainNouns).toEqual(["Practice", "Appointment"]);
    expect(mapping.capabilities).toEqual(["Notify eligible patients"]);
    expect(mapping.workPackages[0]).toMatchObject({
      kind: "pattern-instance",
      target: "notifications",
    });
    expect(mapping.handoffPrompt).toContain(
      "Fill cancelled dental appointments",
    );
    expect(mapping.handoffPrompt).toContain(
      "pnpm template:add-notifications --write",
    );
    expect(mapping.primaryAction).toBe("start-building");
  });

  it("turns unsupported requirements into explicit template-gap work", () => {
    const mapping = mapCompleteBuildPackToMaestro({
      pack: {
        productBrief: "Native field app",
        customerAndProblem: "Field teams need offline work.",
        scope: ["Native offline sync"],
        requirements: ["Work offline on iOS"],
        userJourneys: ["Technician completes a job offline"],
        dataModel: ["Job — field assignment"],
        architecture: "Native mobile client",
        integrations: [],
        securityAndPrivacy: ["Encrypted local data"],
        deliveryPlan: ["Prototype"],
        acceptanceCriteria: ["Works without connectivity"],
        risks: ["Sync conflicts"],
        openQuestions: [],
        competitorClaims: [],
      },
      fitScore: 30,
      purchaseCreditCents: 2_900,
      blueprint: { id: "native-mobile", status: "planned" },
      catalog: [],
      gaps: [
        {
          target: "native offline mobile",
          templateBacklogRef: "MAESTRO-GAP-17",
          templateResolutionPath: "Deliver the Build Pack to a native agency.",
          followUpGates: ["offline acceptance journey"],
        },
      ],
    });

    expect(mapping.primaryAction).toBe("take-spec-elsewhere");
    expect(mapping.workPackages).toContainEqual(
      expect.objectContaining({
        kind: "template-gap",
        templateBacklogRef: "MAESTRO-GAP-17",
      }),
    );
  });
});
