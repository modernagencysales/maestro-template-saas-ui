import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { testConfectLayer } from "./support/confect";

const answers = {
  ideaSummary: "ChairFill fills cancelled dental appointments",
  customer: "Independent dental groups",
  problem: "Last-minute cancellations waste chair capacity",
  currentAlternative: "Receptionists call waitlists manually",
  solution: "Match and notify eligible patients automatically",
  differentiation: "Treatment-aware matching",
  distributionEvidence: "Three practices agreed to pilot",
  founderContext: "Former multi-site dental operator",
};

const createOwnedReport = Effect.gen(function* () {
  const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
  const evaluated = yield* confect.mutation(
    refs.public.capabilities.evaluateAppIdea.evaluateAppIdea,
    {
      sessionId: "revision_session",
      accessToken: "revision_access",
      answers,
    },
  );
  const requested = yield* confect.action(
    refs.public.capabilities.manageEvaluationReport
      .requestReportEmailVerification,
    {
      reportId: evaluated.reportId,
      accessToken: "revision_access",
      email: "revision@example.test",
    },
  );
  const verificationToken =
    new URL(
      requested.fakeVerificationUrl ?? "",
      "https://example.test",
    ).searchParams.get("token") ?? "";
  const ownership = yield* confect.mutation(
    refs.public.capabilities.manageEvaluationReport
      .consumeReportEmailVerification,
    { verificationToken },
  );
  return { confect, ...ownership };
});

describe("server-generated report revisions", () => {
  it("appends a validated version while retaining the original", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId, ownerAccessToken } = yield* createOwnedReport;
      const before = yield* confect.query(
        refs.public.capabilities.manageEvaluationReport.getEvaluationReport,
        { reportId, ownerAccessToken },
      );
      const revised = yield* confect.action(
        refs.public.capabilities.manageEvaluationReport
          .reviseEvaluationReportWithModel,
        {
          reportId,
          ownerAccessToken,
          feedback:
            "Focus the first version on practices with at least three locations.",
        },
      );
      const after = yield* confect.query(
        refs.public.capabilities.manageEvaluationReport.getEvaluationReport,
        { reportId, ownerAccessToken },
      );
      const versions = yield* confect.query(
        refs.public.capabilities.manageEvaluationReport
          .listEvaluationReportVersions,
        { reportId, ownerAccessToken },
      );
      return { before, revised, after, versions };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.before.currentVersion).toBe(1);
    expect(result.revised).toMatchObject({ status: "revised", version: 2 });
    expect(result.after.currentVersion).toBe(2);
    expect(result.versions.map(({ version }) => version)).toEqual([1, 2]);
    expect(result.versions[0]?.reportJson).toBe(result.before.reportJson);
    expect(result.versions[1]?.reportJson).toBe(result.after.reportJson);
    expect(result.after.reportJson).toContain("three locations");
  });

  it("requires verified ownership and leaves version one current", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId } = yield* createOwnedReport;
      return yield* confect.action(
        refs.public.capabilities.manageEvaluationReport
          .reviseEvaluationReportWithModel,
        {
          reportId,
          ownerAccessToken: "wrong-token",
          feedback: "Change the customer.",
        },
      );
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).rejects.toBeDefined();
  });
});
