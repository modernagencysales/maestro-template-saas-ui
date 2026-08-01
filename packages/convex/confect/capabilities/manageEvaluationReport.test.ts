import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";

import {
  normalizeManageEvaluationReportInput,
  validateManageEvaluationReportInput,
} from "./manageEvaluationReport.domain";
import { manageEvaluationReportArgs } from "./manageEvaluationReport.spec";

describe("manageEvaluationReport capability domain", () => {
  it("exposes explicit report lifecycle actions", () => {
    expect(() =>
      Schema.decodeUnknownSync(manageEvaluationReportArgs)({
        reportId: "report_1",
        accessToken: "token_1",
        action: "revoke-share",
      }),
    ).not.toThrow();
  });

  it("normalizes report ownership and share operations", () => {
    expect(
      normalizeManageEvaluationReportInput({
        reportId: " report_1 ",
        accessToken: " token_1 ",
        action: "share",
      }),
    ).toEqual({
      reportId: "report_1",
      accessToken: "token_1",
      action: "share",
    });
  });

  it("requires revision content only for a revision", () => {
    expect(
      validateManageEvaluationReportInput({
        reportId: "report_1",
        accessToken: "token_1",
        action: "revise",
      }),
    ).toContain("revisionJson is required to revise a report.");
    expect(
      validateManageEvaluationReportInput({
        reportId: "report_1",
        accessToken: "token_1",
        action: "revoke-share",
      }),
    ).toEqual([]);
  });
});
