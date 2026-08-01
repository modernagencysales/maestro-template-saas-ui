import { describe, expect, it, vi } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";
import {
  completeFakeBuildPack,
  loadBuildPack,
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
});
