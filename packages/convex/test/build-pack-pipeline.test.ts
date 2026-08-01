import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
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
  it("requires a specific operator reason before support resume", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* Effect.serviceOptional(
        TestConfect.TestConfect<typeof databaseSchema>(),
      );
      return yield* confect.mutation(refs.internal.buildPacks.support.resume, {
        incidentId: "support_missing",
        operatorReason: " ",
      });
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).rejects.toThrow("specific operator reason");
  });

  it("creates a durable support id and resumes with an operator reason", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId, ownerAccessToken } =
        yield* createOwnedPaidReport;
      const started = yield* confect.mutation(
        refs.public.buildPacks.packs.startPack,
        { reportId, ownerAccessToken },
      );
      yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const writer = yield* DatabaseWriter;
          const stage = yield* reader
            .table("buildPackStages")
            .index("by_pack_stage", (q) =>
              q.eq("packId", started.packId).eq("stageName", "normalize"),
            )
            .first()
            .pipe(Effect.map(Option.getOrThrow), Effect.orDie);
          yield* writer
            .table("buildPackStages")
            .patch(stage._id, { attempts: 3 })
            .pipe(Effect.orDie);
        }),
      );
      yield* confect.mutation(refs.internal.buildPacks.packs.claimStage, {
        packId: started.packId,
        leaseId: "exhausted-runner",
      });
      const exhausted = {
        ...started,
        status: "needs-support" as const,
        stages: started.stages.map((stage, index) =>
          index === 0
            ? {
                ...stage,
                status: "needs-support" as const,
                attempts: 3,
                error: "provider capacity",
              }
            : stage,
        ),
      };
      yield* confect.mutation(
        refs.internal.buildPacks.packs.persistCheckpoint,
        {
          packId: started.packId,
          runJson: JSON.stringify(exhausted),
          stage: "normalize",
          leaseId: "exhausted-runner",
        },
      );
      const paused = yield* confect.query(refs.public.buildPacks.packs.status, {
        packId: started.packId,
        ownerAccessToken,
      });
      const resumed = yield* confect.mutation(
        refs.internal.buildPacks.support.resume,
        {
          incidentId: paused.supportId ?? "",
          operatorReason: "Provider capacity restored.",
        },
      );
      return { paused, resumed };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.paused).toMatchObject({
      status: "needs-support",
      supportId: expect.stringMatching(/^support_/),
    });
    expect(result.resumed).toMatchObject({
      status: "running",
      operatorReason: "Provider capacity restored.",
      failedStage: "normalize",
    });
    expect(result.resumed.attempt).toBe(4);
  });

  it("returns a server-owned Maestro offer backed by the active purchase credit", async () => {
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
      return yield* confect.query(refs.public.buildPacks.maestro.getOffer, {
        packId: started.packId,
        ownerAccessToken,
      });
    });

    const offer = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(offer).toMatchObject({
      creditCents: 2_900,
      creditStatus: "available",
      blueprintStatus: "implemented",
    });
    expect(JSON.parse(offer.mappingJson)).toMatchObject({
      purchaseCreditCents: 2_900,
      primaryAction: "start-building",
      handoffPrompt: expect.stringContaining("Build the product described"),
    });
  });

  it("denies the Maestro offer to the wrong owner", async () => {
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
      return yield* confect.query(refs.public.buildPacks.maestro.getOffer, {
        packId: started.packId,
        ownerAccessToken: "wrong-owner",
      });
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).rejects.toBeDefined();
  });

  it("denies the Maestro offer after its persisted credit is revoked", async () => {
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
      yield* confect.action(refs.public.commerce.webhooks.applyDodo, {
        rawBody: JSON.stringify({
          type: "refund.succeeded",
          data: { payment_id: "payment_pack_1" },
        }),
        webhookId: "event_pack_refunded_before_maestro",
      });
      return yield* confect.query(refs.public.buildPacks.maestro.getOffer, {
        packId: started.packId,
        ownerAccessToken,
      });
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).rejects.toBeDefined();
  });

  it("atomically lets only one runner lease a stage attempt", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId, ownerAccessToken } =
        yield* createOwnedPaidReport;
      const started = yield* confect.mutation(
        refs.public.buildPacks.packs.startPack,
        { reportId, ownerAccessToken },
      );
      const first = yield* confect.mutation(
        refs.internal.buildPacks.packs.claimStage,
        { packId: started.packId, leaseId: "runner-one" },
      );
      const duplicate = yield* confect.mutation(
        refs.internal.buildPacks.packs.claimStage,
        { packId: started.packId, leaseId: "runner-two" },
      );
      return { first, duplicate };
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).resolves.toMatchObject({
      first: { claimed: true, stage: "normalize", attempt: 1 },
      duplicate: { claimed: false },
    });
  });

  it("lets duplicate actions exit without duplicate stage spend", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId, ownerAccessToken } =
        yield* createOwnedPaidReport;
      const started = yield* confect.mutation(
        refs.public.buildPacks.packs.startPack,
        { reportId, ownerAccessToken },
      );
      yield* Effect.promise(() =>
        Promise.all([
          Effect.runPromise(
            confect.action(refs.internal.buildPacks.packs.runPack, {
              packId: started.packId,
            }),
          ),
          Effect.runPromise(
            confect.action(refs.internal.buildPacks.packs.runPack, {
              packId: started.packId,
            }),
          ),
        ]),
      );
      const status = yield* confect.query(refs.public.buildPacks.packs.status, {
        packId: started.packId,
        ownerAccessToken,
      });
      const premiumReceipts = yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const receipts = yield* reader
            .table("modelReceipts")
            .index("by_report", (q) => q.eq("reportId", reportId))
            .collect()
            .pipe(Effect.orDie);
          return receipts.filter(({ tier }) => tier === "premium").length;
        }),
        Schema.Number,
      );
      return { status: status.status, premiumReceipts };
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).resolves.toEqual({ status: "completed", premiumReceipts: 8 });
  });

  it("revokes the pack before another model stage after a refund", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId, ownerAccessToken } =
        yield* createOwnedPaidReport;
      const started = yield* confect.mutation(
        refs.public.buildPacks.packs.startPack,
        { reportId, ownerAccessToken },
      );
      yield* confect.mutation(refs.internal.buildPacks.packs.claimStage, {
        packId: started.packId,
        leaseId: "first-stage-runner",
      });
      const afterFirstStage = {
        ...started,
        stages: started.stages.map((stage, index) =>
          index === 0
            ? { ...stage, status: "completed" as const, output: "normalized" }
            : index === 1
              ? { ...stage, status: "running" as const, attempts: 1 }
              : stage,
        ),
      };
      yield* confect.mutation(
        refs.internal.buildPacks.packs.persistCheckpoint,
        {
          packId: started.packId,
          runJson: JSON.stringify(afterFirstStage),
          stage: "normalize",
          leaseId: "first-stage-runner",
        },
      );
      yield* confect.action(refs.public.commerce.webhooks.applyDodo, {
        rawBody: JSON.stringify({
          type: "refund.succeeded",
          data: { payment_id: "payment_pack_1" },
        }),
        webhookId: "event_pack_refunded_between_stages",
      });
      const claim = yield* confect.mutation(
        refs.internal.buildPacks.packs.claimStage,
        { packId: started.packId, leaseId: "second-stage-runner" },
      );
      const status = yield* confect.query(refs.public.buildPacks.packs.status, {
        packId: started.packId,
        ownerAccessToken,
      });
      return { claim, status: status.status };
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).resolves.toEqual({ claim: { claimed: false }, status: "revoked" });
  });

  it("counts only the current UTC day's spend across every report", async () => {
    const program = Effect.gen(function* () {
      const { confect, reportId, ownerAccessToken } =
        yield* createOwnedPaidReport;
      const started = yield* confect.mutation(
        refs.public.buildPacks.packs.startPack,
        { reportId, ownerAccessToken },
      );
      const before = yield* confect.query(
        refs.internal.buildPacks.packs.loadPackRun,
        { packId: started.packId },
      );
      const now = Date.now();
      yield* confect.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          for (const receipt of [
            { receiptId: "other-report-today", generatedAt: now, cents: 17 },
            {
              receiptId: "other-report-yesterday",
              generatedAt: now - 86_400_000,
              cents: 29,
            },
          ]) {
            yield* writer
              .table("modelReceipts")
              .insert({
                receiptId: receipt.receiptId,
                sessionId: "other-session",
                reportId: "other-report",
                tier: "premium",
                stage: "test",
                provider: "test",
                mode: "fake",
                model: "test",
                repair: false,
                inputTokens: 1,
                outputTokens: 1,
                estimatedCents: receipt.cents,
                generatedAt: receipt.generatedAt,
              })
              .pipe(Effect.orDie);
          }
        }),
      );
      const after = yield* confect.query(
        refs.internal.buildPacks.packs.loadPackRun,
        { packId: started.packId },
      );
      return after.currentDailySpendCents - before.currentDailySpendCents;
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).resolves.toBe(17);
  });

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
      yield* confect.mutation(refs.internal.buildPacks.packs.claimStage, {
        packId: started.packId,
        leaseId: "failed-runner",
      });
      yield* confect.mutation(
        refs.internal.buildPacks.packs.persistCheckpoint,
        {
          packId: started.packId,
          runJson: JSON.stringify(failedRun),
          stage: "normalize",
          leaseId: "failed-runner",
        },
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
