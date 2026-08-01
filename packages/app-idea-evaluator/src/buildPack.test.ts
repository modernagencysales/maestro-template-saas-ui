import { describe, expect, it } from "vitest";

import {
  advanceBuildPack,
  buildPackStageNames,
  createBuildPackRun,
  failBuildPackStage,
  retryBuildPackStage,
  validateCompleteBuildPack,
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
});
