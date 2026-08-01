import { describe, expect, it, vi } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";
import {
  completeFakeBuildPack,
  failFakeBuildPackAtCheckpoint,
  loadBuildPack,
  retryFakeBuildPack,
  saveBuildPack,
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
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    try {
      saveBuildPack(completed);
      expect(loadBuildPack(completed.run.packId)).toEqual(completed);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("retries only the failed checkpoint and retains completed output", () => {
    const evaluation = makeEvaluation(fixtureCompleteAnswers);
    const started = startBuildPackGeneration({
      evaluation,
      entitlementStatus: "active",
    });
    const failed = failFakeBuildPackAtCheckpoint(started);
    const completedCheckpoint = failed.run.stages[0];

    const retried = retryFakeBuildPack(failed, evaluation);

    expect(failed.run.status).toBe("failed-recoverable");
    expect(retried.run.status).toBe("completed");
    expect(retried.run.stages[0]).toEqual(completedCheckpoint);
    expect(retried.run.stages[1]?.attempts).toBe(2);
    expect(retried.pack).toBeDefined();
  });
});
