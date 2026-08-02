import { describe, expect, it, vi } from "vitest";

import {
  advanceBuildPack,
  createBuildPackRun,
  failBuildPackStage,
  retryBuildPackStage,
} from "./buildPack";
import { executePremiumBuildPack } from "./premiumPipeline";

const validPack = {
  productBrief: "A focused product brief",
  customerAndProblem: "Dental groups lose revenue to cancellations.",
  scope: ["Waitlist matching"],
  requirements: ["Notify an eligible patient"],
  userJourneys: ["Practice fills a cancelled chair"],
  dataModel: ["Practice", "Appointment", "Patient"],
  architecture: "A tenant-aware web application with durable jobs.",
  integrations: ["Email"],
  securityAndPrivacy: ["Encrypt patient data"],
  deliveryPlan: ["Validate", "Build", "Pilot"],
  acceptanceCriteria: ["A cancellation can be filled end to end"],
  risks: ["Patient consent"],
  openQuestions: ["Which practice system launches first?"],
  competitorClaims: [
    {
      text: "Existing tools focus on generic reminders.",
      citations: ["https://example.test/source"],
    },
  ],
};

describe("premium Build Pack execution", () => {
  it("checkpoints every stage and returns the validated canonical pack", async () => {
    const run = createBuildPackRun({
      packId: "pack_1",
      reportId: "report_1",
      reportVersion: 1,
      entitlementStatus: "active",
    });
    const checkpoint = vi.fn();

    const result = await executePremiumBuildPack({
      run,
      runStage: async ({ stage }) =>
        stage === "compile" ? JSON.stringify(validPack) : `${stage} output`,
      checkpoint,
    });

    expect(result.run.status).toBe("completed");
    expect(result.pack).toEqual(validPack);
    expect(checkpoint).toHaveBeenCalledTimes(8);
  });

  it("resumes at the recoverable stage without calling completed stages", async () => {
    let run = createBuildPackRun({
      packId: "pack_resume",
      reportId: "report_1",
      reportVersion: 1,
      entitlementStatus: "active",
    });
    run = advanceBuildPack(run, "normalized");
    run = advanceBuildPack(run, "challenged");
    run = failBuildPackStage(run, "provider unavailable");
    run = retryBuildPackStage(run);
    const called: string[] = [];

    const result = await executePremiumBuildPack({
      run,
      runStage: async ({ stage }) => {
        called.push(stage);
        return stage === "compile"
          ? JSON.stringify(validPack)
          : `${stage} output`;
      },
      checkpoint: async () => undefined,
    });

    expect(called).toEqual([
      "research",
      "design",
      "specify",
      "review",
      "compile",
      "map-to-maestro",
    ]);
    expect(result.run.stages[0]?.attempts).toBe(1);
    expect(result.run.stages[1]?.attempts).toBe(1);
  });

  it("persists a recoverable failure and does not continue", async () => {
    const run = createBuildPackRun({
      packId: "pack_failure",
      reportId: "report_1",
      reportVersion: 1,
      entitlementStatus: "active",
    });
    const checkpoint = vi.fn();

    const result = await executePremiumBuildPack({
      run,
      runStage: async () => {
        throw new Error("provider unavailable");
      },
      checkpoint,
    });

    expect(result.pack).toBeNull();
    expect(result.run.status).toBe("failed-recoverable");
    expect(checkpoint).toHaveBeenCalledOnce();
  });
});
