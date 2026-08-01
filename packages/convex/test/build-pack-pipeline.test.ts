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

const createOwnedPaidReport = Effect.gen(function* () {
  const confect = yield* Effect.serviceOptional(
    TestConfect.TestConfect<typeof databaseSchema>(),
  );
  const evaluated = yield* confect.mutation(
    refs.public.capabilities.evaluateAppIdea.evaluateAppIdea,
    { sessionId: "pack_session", accessToken: "pack_access", answers },
  );
  const requested = yield* confect.action(
    refs.public.capabilities.manageEvaluationReport
      .requestReportEmailVerification,
    {
      reportId: evaluated.reportId,
      accessToken: "pack_access",
      email: "builder@example.test",
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
  const checkout = yield* confect.action(refs.public.commerce.checkout.create, {
    reportId: evaluated.reportId,
    ownerAccessToken: ownership.ownerAccessToken,
    email: "builder@example.test",
  });
  yield* confect.action(refs.public.commerce.webhooks.applyDodo, {
    rawBody: JSON.stringify({
      type: "payment.succeeded",
      data: {
        payment_id: "payment_pack_1",
        checkout_session_id: checkout.checkoutSessionId,
      },
    }),
    webhookId: "event_pack_paid_1",
  });
  return {
    confect,
    reportId: evaluated.reportId,
    ownerAccessToken: ownership.ownerAccessToken,
  };
});

describe("durable Complete Build Pack capability", () => {
  it("runs all eight entitled checkpoints and stores the canonical pack", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId, ownerAccessToken } =
        yield* createOwnedPaidReport;
      const started = yield* confect.mutation(
        refs.public.buildPacks.packs.startPack,
        { reportId, ownerAccessToken },
      );
      yield* confect.action(refs.internal.buildPacks.packs.runPack, {
        packId: started.packId,
      });
      const status = yield* confect.query(refs.public.buildPacks.packs.status, {
        packId: started.packId,
        ownerAccessToken,
      });
      const completed = yield* confect.query(
        refs.public.buildPacks.packs.getPack,
        { packId: started.packId, ownerAccessToken },
      );
      return { started, status, completed };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.started).toMatchObject({ status: "running" });
    expect(result.status.status, JSON.stringify(result.status)).toBe(
      "completed",
    );
    expect(result.status.stages).toHaveLength(8);
    expect(
      result.status.stages.every(({ status }) => status === "completed"),
    ).toBe(true);
    expect(JSON.parse(result.completed.canonicalPackJson)).toMatchObject({
      productBrief: expect.any(String),
      requirements: expect.any(Array),
      acceptanceCriteria: expect.any(Array),
    });
  });

  it("rejects generation before a purchase activates entitlement", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* Effect.serviceOptional(
        TestConfect.TestConfect<typeof databaseSchema>(),
      );
      const evaluated = yield* confect.mutation(
        refs.public.capabilities.evaluateAppIdea.evaluateAppIdea,
        {
          sessionId: "unpaid_pack_session",
          accessToken: "unpaid_pack_access",
          answers,
        },
      );
      return yield* confect.mutation(refs.public.buildPacks.packs.startPack, {
        reportId: evaluated.reportId,
        ownerAccessToken: "not-an-owner-token",
      });
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).rejects.toBeDefined();
  });

  it("retries only the recoverable checkpoint without another purchase", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId, ownerAccessToken } =
        yield* createOwnedPaidReport;
      const started = yield* confect.mutation(
        refs.public.buildPacks.packs.startPack,
        { reportId, ownerAccessToken },
      );
      const failedRun = {
        ...started,
        status: "failed-recoverable" as const,
        stages: started.stages.map((stage, index) =>
          index === 0
            ? {
                ...stage,
                status: "failed-recoverable" as const,
                error: "provider capacity",
              }
            : stage,
        ),
      };
      yield* confect.mutation(
        refs.internal.buildPacks.packs.persistCheckpoint,
        { packId: started.packId, runJson: JSON.stringify(failedRun) },
      );
      const retried = yield* confect.mutation(
        refs.public.buildPacks.packs.retryFailedStage,
        { packId: started.packId, ownerAccessToken },
      );
      const samePurchase = yield* confect.action(
        refs.public.commerce.checkout.create,
        {
          reportId,
          ownerAccessToken,
          email: "builder@example.test",
        },
      );
      return { started, retried, samePurchase };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.retried.packId).toBe(result.started.packId);
    expect(result.retried.stages[0]).toMatchObject({
      status: "running",
      attempts: 2,
    });
    expect(result.samePurchase.status).toBe("paid");
  });

  it("rejects changes to completed checkpoint output", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId, ownerAccessToken } =
        yield* createOwnedPaidReport;
      const started = yield* confect.mutation(
        refs.public.buildPacks.packs.startPack,
        { reportId, ownerAccessToken },
      );
      yield* confect.action(refs.internal.buildPacks.packs.runPack, {
        packId: started.packId,
      });
      const completed = yield* confect.query(
        refs.public.buildPacks.packs.status,
        { packId: started.packId, ownerAccessToken },
      );
      const tampered = {
        ...completed,
        stages: completed.stages.map((stage, index) =>
          index === 0 ? { ...stage, output: "rewritten output" } : stage,
        ),
      };
      return yield* confect.mutation(
        refs.internal.buildPacks.packs.persistCheckpoint,
        { packId: started.packId, runJson: JSON.stringify(tampered) },
      );
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).rejects.toThrow("Completed Build Pack checkpoints are immutable");
  });
});
