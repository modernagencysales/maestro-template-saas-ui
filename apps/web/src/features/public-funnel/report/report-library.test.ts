import { describe, expect, it } from "vitest";

import {
  addReportToLibrary,
  createReportLibrary,
  revokeReportShare,
  shareReportSnapshot,
} from "./report-library";
import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";

describe("saved report lifecycle", () => {
  it("adds a report once and keeps newest reports first", () => {
    const first = makeEvaluation(
      fixtureCompleteAnswers,
      "2026-07-30T00:00:00.000Z",
    );
    const second = makeEvaluation(
      { ...fixtureCompleteAnswers, ideaSummary: "A second useful app" },
      "2026-07-31T00:00:00.000Z",
    );
    const library = addReportToLibrary(
      addReportToLibrary(createReportLibrary(), first),
      second,
    );

    expect(library.reports.map(({ id }) => id)).toEqual([second.id, first.id]);
    expect(addReportToLibrary(library, second).reports).toHaveLength(2);
  });

  it("shares only the approved public snapshot", () => {
    const evaluation = makeEvaluation(fixtureCompleteAnswers);
    const share = shareReportSnapshot(evaluation, "share_token_1");
    const serialized = JSON.stringify(share);

    expect(share.snapshot.verdict).toBe(evaluation.report.verdict);
    expect(serialized).not.toContain(fixtureCompleteAnswers.problem);
    expect(serialized).not.toContain("answers");
  });

  it("revokes a share without deleting the private report", () => {
    const evaluation = makeEvaluation(fixtureCompleteAnswers);
    const library = addReportToLibrary(createReportLibrary(), evaluation);
    const shared = shareReportSnapshot(evaluation, "share_token_1");
    const revoked = revokeReportShare(shared);

    expect(revoked.status).toBe("revoked");
    expect(library.reports).toHaveLength(1);
  });
});
