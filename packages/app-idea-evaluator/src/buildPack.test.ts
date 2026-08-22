import { describe, expect, it } from "vitest";

import {
  advanceBuildPack,
  buildPackStageNames,
  createBuildPackRun,
  failBuildPackStage,
  retryBuildPackStage,
  validateCompleteBuildPack,
  decodeCompleteBuildPack,
} from "./buildPack";

describe("checkpointed Complete Build Pack", () => {
  it("defines every quality stage in order", () => {
    expect(buildPackStageNames).toEqual([
      "normalize",
      "challenge",
      "research",
      "design",
      "specify",
      "review",
      "compile",
      "map-to-maestro",
    ]);
  });

  it("requires an active entitlement before starting", () => {
    expect(() =>
      createBuildPackRun({
        packId: "pack_1",
        reportId: "idea_1",
        reportVersion: 1,
        entitlementStatus: "revoked",
      }),
    ).toThrow("active entitlement");
  });

  it("resumes a failed stage without rerunning completed stages", () => {
    let run = createBuildPackRun({
      packId: "pack_1",
      reportId: "idea_1",
      reportVersion: 1,
      entitlementStatus: "active",
    });
    run = advanceBuildPack(run, "normalized brief");
    run = advanceBuildPack(run, "challenged assumptions");
    run = failBuildPackStage(run, "provider unavailable");
    run = retryBuildPackStage(run);

    expect(run.stages[0]).toMatchObject({ status: "completed", attempts: 1 });
    expect(run.stages[1]).toMatchObject({ status: "completed", attempts: 1 });
    expect(run.stages[2]).toMatchObject({ status: "running", attempts: 2 });
  });

  it("keeps completed checkpoint output immutable through later retries", () => {
    let run = createBuildPackRun({
      packId: "pack_immutable",
      reportId: "idea_1",
      reportVersion: 1,
      entitlementStatus: "active",
    });
    run = advanceBuildPack(run, "canonical normalized brief");
    const completed = run.stages[0];
    run = failBuildPackStage(run, "provider unavailable");
    run = retryBuildPackStage(run);

    expect(run.stages[0]).toBe(completed);
    expect(run.stages[0]?.output).toBe("canonical normalized brief");
  });

  it("escalates the third failed attempt to support instead of retrying forever", () => {
    let run = createBuildPackRun({
      packId: "pack_support",
      reportId: "idea_1",
      reportVersion: 1,
      entitlementStatus: "active",
    });
    run = failBuildPackStage(run, "failure 1");
    run = retryBuildPackStage(run);
    run = failBuildPackStage(run, "failure 2");
    run = retryBuildPackStage(run);
    run = failBuildPackStage(run, "failure 3");

    expect(run.status).toBe("needs-support");
    expect(run.stages[0]).toMatchObject({
      status: "needs-support",
      attempts: 3,
      error: "failure 3",
    });
    expect(() => retryBuildPackStage(run)).toThrow("support");
  });

  it("rejects researched competitor claims without citations", () => {
    expect(() =>
      validateCompleteBuildPack({
        productBrief: "Brief",
        customerAndProblem: "Customer",
        scope: ["First capability"],
        requirements: ["Requirement"],
        userJourneys: ["Journey"],
        dataModel: ["Entity"],
        architecture: "Architecture",
        integrations: [],
        securityAndPrivacy: ["Control"],
        deliveryPlan: ["Phase"],
        acceptanceCriteria: ["Criterion"],
        risks: ["Risk"],
        openQuestions: [],
        competitorClaims: [{ text: "Competitor X is cheaper", citations: [] }],
      }),
    ).toThrow("citation");
  });

  it("rejects blank citations and unknown compiler fields", () => {
    const fixture = {
      productBrief: "Brief",
      customerAndProblem: "Customer",
      scope: ["First capability"],
      requirements: ["Requirement"],
      userJourneys: ["Journey"],
      dataModel: ["Entity"],
      architecture: "Architecture",
      integrations: [],
      securityAndPrivacy: ["Control"],
      deliveryPlan: ["Phase"],
      acceptanceCriteria: ["Criterion"],
      risks: ["Risk"],
      openQuestions: [],
      competitorClaims: [{ text: "Claim", citations: [" "] }],
      leakedPrompt: "must not survive decoding",
    };

    expect(() => decodeCompleteBuildPack(fixture)).toThrow();
  });
});
