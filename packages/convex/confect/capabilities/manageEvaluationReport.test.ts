import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";

import {
  normalizeManageEvaluationReportInput,
  validateManageEvaluationReportInput,
} from "./manageEvaluationReport.domain";
import {
  consumeReportEmailVerificationArgs,
  getEvaluationReportArgs,
  listOwnedEvaluationReportsArgs,
  manageEvaluationReportArgs,
  requestReportEmailVerification,
  requestReportEmailVerificationArgs,
} from "./manageEvaluationReport.spec";

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

  it("allows a verified owner credential for report lifecycle actions", () => {
    expect(
      validateManageEvaluationReportInput({
        reportId: "report_1",
        ownerAccessToken: "owner_secret",
        action: "share",
      }),
    ).toEqual([]);
    expect(
      validateManageEvaluationReportInput({
        reportId: "report_1",
        action: "share",
      }),
    ).toContain("An anonymous or verified-owner access token is required.");
  });

  it("exposes verification and opaque-owner library contracts", () => {
    expect(requestReportEmailVerification.runtimeAndFunctionType).toEqual({
      runtime: "Convex",
      functionType: "action",
    });
    expect(() =>
      Schema.decodeUnknownSync(requestReportEmailVerificationArgs)({
        reportId: "report_1",
        accessToken: "anonymous_secret",
        email: "founder@example.test",
      }),
    ).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(consumeReportEmailVerificationArgs)({
        verificationToken: "verification_secret",
      }),
    ).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(listOwnedEvaluationReportsArgs)({
        ownerAccessToken: "owner_secret",
      }),
    ).not.toThrow();
  });

  it("requires an opaque anonymous or verified-owner credential to read a report", () => {
    expect(() =>
      Schema.decodeUnknownSync(getEvaluationReportArgs)({
        reportId: "report_1",
        accessToken: "anonymous_secret",
      }),
    ).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(getEvaluationReportArgs)({
        reportId: "report_1",
        ownerAccessToken: "owner_secret",
      }),
    ).not.toThrow();
  });
});
