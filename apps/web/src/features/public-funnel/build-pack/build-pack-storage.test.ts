import { describe, expect, it } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";
import {
  completeFakeBuildPack,
  startBuildPackGeneration,
} from "./build-pack-storage";

describe("paid Build Pack generation coordinator", () => {
  it("requires an active entitlement before generation starts", () => {
    expect(() =>
      startBuildPackGeneration({
        evaluation: makeEvaluation(fixtureCompleteAnswers),
        entitlementStatus: "missing",
      }),
    ).toThrow(/active entitlement/i);
  });

  it("stores checkpoint progress and the canonical completed artifact", () => {
    const evaluation = makeEvaluation(
      fixtureCompleteAnswers,
      "2026-07-31T00:00:00.000Z",
    );
    const started = startBuildPackGeneration({
      evaluation,
      entitlementStatus: "active",
    });
    const completed = completeFakeBuildPack(started, evaluation);

    expect(completed.run.status).toBe("completed");
    expect(
      completed.run.stages.every(({ status }) => status === "completed"),
    ).toBe(true);
    expect(completed.pack?.requirements.length).toBeGreaterThanOrEqual(5);
  });
});
