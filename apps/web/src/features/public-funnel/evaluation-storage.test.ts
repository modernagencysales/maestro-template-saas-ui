import { describe, expect, it, vi } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "./intake/evaluation-adapter";
import {
  listEvaluationIds,
  loadEvaluation,
  saveEvaluation,
} from "./evaluation-storage";

describe("evaluation browser storage", () => {
  it("saves, loads, and lists an anonymous report", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    try {
      const evaluation = makeEvaluation(
        fixtureCompleteAnswers,
        "2026-07-31T00:00:00.000Z",
      );
      saveEvaluation(evaluation);
      expect(loadEvaluation(evaluation.id)).toEqual(evaluation);
      expect(listEvaluationIds()).toEqual([evaluation.id]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
