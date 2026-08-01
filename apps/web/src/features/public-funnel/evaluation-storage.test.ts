import { describe, expect, it, vi } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "./intake/evaluation-adapter";
import {
  appendEvaluationRevision,
  listEvaluationIds,
  loadEvaluationVersions,
  loadEvaluation,
  saveEvaluation,
  deleteEvaluation,
} from "./evaluation-storage";

describe("evaluation browser storage", () => {
  it("saves, loads, and lists an anonymous report", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
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
      deleteEvaluation(evaluation.id);
      expect(loadEvaluation(evaluation.id)).toBeNull();
      expect(listEvaluationIds()).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("appends a revised report while retaining the original version", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    try {
      const original = makeEvaluation(
        fixtureCompleteAnswers,
        "2026-07-31T00:00:00.000Z",
      );
      saveEvaluation(original);

      const revision = appendEvaluationRevision(
        original.id,
        "We interviewed three practice owners who need specialist cancellation matching.",
        "2026-07-31T01:00:00.000Z",
      );

      expect(revision?.version).toBe(2);
      expect(loadEvaluationVersions(original.id)).toHaveLength(2);
      expect(loadEvaluationVersions(original.id)[0]?.evaluation).toEqual(
        original,
      );
      expect(loadEvaluation(original.id)?.answers.differentiation).toContain(
        "specialist cancellation matching",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
