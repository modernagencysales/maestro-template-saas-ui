import { describe, expect, it } from "vitest";

import {
  appendAnswer,
  completeEvaluationSession,
  createEvaluationSession,
  reviseEvaluationReport,
  verifyEvaluationAccess,
} from "../confect/evaluator/state";

describe("evaluation persistence state", () => {
  it("stores only a hash of the opaque anonymous access token", () => {
    const session = createEvaluationSession({
      sessionId: "session_1",
      accessToken: "opaque_secret_token",
      createdAt: 1_000,
    });

    expect(session.accessTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(session)).not.toContain("opaque_secret_token");
    expect(verifyEvaluationAccess(session, "opaque_secret_token")).toBe(true);
    expect(verifyEvaluationAccess(session, "wrong_token")).toBe(false);
  });

  it("rejects completion without every required answer", () => {
    const session = appendAnswer(
      createEvaluationSession({
        sessionId: "session_1",
        accessToken: "opaque_secret_token",
        createdAt: 1_000,
      }),
      { questionId: "ideaSummary", value: "An idea", savedAt: 2_000 },
    );

    expect(() => completeEvaluationSession(session, 3_000)).toThrow(
      "missing required answers",
    );
  });

  it("revises by appending a report version", () => {
    const revised = reviseEvaluationReport(
      {
        reportId: "report_1",
        currentVersion: 1,
        versions: [
          { version: 1, reportJson: '{"score":70}', createdAt: 1_000 },
        ],
      },
      { reportJson: '{"score":78}', createdAt: 2_000 },
    );

    expect(revised.currentVersion).toBe(2);
    expect(revised.versions).toHaveLength(2);
    expect(revised.versions[0]?.reportJson).toBe('{"score":70}');
  });
});
