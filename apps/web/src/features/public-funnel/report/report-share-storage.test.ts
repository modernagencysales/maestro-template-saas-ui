import { describe, expect, it } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";
import {
  createStoredReportShare,
  loadStoredReportShare,
  revokeStoredReportShare,
  type ReportShareStorage,
} from "./report-share-storage";

const memoryStorage = (): ReportShareStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

describe("public report share storage", () => {
  it("stores only the public snapshot and resolves an active token", () => {
    const storage = memoryStorage();
    const evaluation = makeEvaluation(fixtureCompleteAnswers);
    const share = createStoredReportShare(storage, evaluation, "share_1");
    expect(loadStoredReportShare(storage, share.token)).toEqual(share);
    expect(JSON.stringify(share)).not.toContain(
      fixtureCompleteAnswers.founderContext,
    );
  });

  it("makes a revoked token unavailable", () => {
    const storage = memoryStorage();
    const evaluation = makeEvaluation(fixtureCompleteAnswers);
    createStoredReportShare(storage, evaluation, "share_1");
    revokeStoredReportShare(storage, "share_1");
    expect(loadStoredReportShare(storage, "share_1")).toBeNull();
  });
});
