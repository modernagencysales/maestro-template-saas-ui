import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { testConfectLayer } from "./support/confect";

const answers = {
  ideaSummary: "A useful app",
  customer: "Dental groups",
  problem: "Cancelled chair time",
  currentAlternative: "Manual phone calls",
  solution: "Automated waitlist matching",
  differentiation: "Matches treatment constraints",
  distributionEvidence: "Three pilot practices",
  founderContext: "Former operator",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("app-idea commerce capabilities", () => {
  it("stays pending after return and grants exactly once from the webhook", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubEnv("ADMAXXER_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetcher);
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const evaluated = yield* confect.mutation(
        refs.public.capabilities.evaluateAppIdea.evaluateAppIdea,
        {
          sessionId: "commerce_session",
          accessToken: "commerce_access",
          answers,
        },
      );
      const verification = yield* confect.action(
        refs.public.capabilities.manageEvaluationReport
          .requestReportEmailVerification,
        {
          reportId: evaluated.reportId,
          accessToken: "commerce_access",
          email: "founder@example.test",
        },
      );
      const verificationToken =
        new URL(
          verification.fakeVerificationUrl ?? "",
          "https://example.test",
        ).searchParams.get("token") ?? "";
      const ownership = yield* confect.mutation(
        refs.public.capabilities.manageEvaluationReport
          .consumeReportEmailVerification,
        { verificationToken },
      );
      const checkout = yield* confect.action(
        refs.public.commerce.checkout.create,
        {
          reportId: evaluated.reportId,
          ownerAccessToken: ownership.ownerAccessToken,
          email: "founder@example.test",
        },
      );
      const returned = yield* confect.mutation(
        refs.public.commerce.checkout.markReturned,
        { checkoutSessionId: checkout.checkoutSessionId },
      );
      const pending = yield* confect.query(
        refs.public.commerce.checkout.status,
        {
          reportId: evaluated.reportId,
          ownerAccessToken: ownership.ownerAccessToken,
        },
      );
      const rawBody = JSON.stringify({
        type: "payment.succeeded",
        data: {
          payment_id: "payment_1",
          checkout_session_id: checkout.checkoutSessionId,
          total_amount: 1,
          currency: "EUR",
        },
      });
      const paid = yield* confect.action(
        refs.public.commerce.webhooks.applyDodo,
        { rawBody, webhookId: "event_paid_1" },
      );
      const duplicate = yield* confect.action(
        refs.public.commerce.webhooks.applyDodo,
        { rawBody, webhookId: "event_paid_1" },
      );
      const active = yield* confect.query(
        refs.public.commerce.checkout.status,
        {
          reportId: evaluated.reportId,
          ownerAccessToken: ownership.ownerAccessToken,
        },
      );
      return { checkout, returned, pending, paid, duplicate, active };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.checkout).toMatchObject({
      amountCents: 2_900,
      currency: "USD",
      status: "checkout-open",
    });
    expect(result.returned.status).toBe("payment-pending");
    expect(result.pending).toMatchObject({
      purchaseStatus: "payment-pending",
      entitlementStatus: "missing",
      maestroCreditStatus: "missing",
    });
    expect(result.paid.status).toBe("processed");
    expect(result.duplicate.status).toBe("duplicate");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.active).toMatchObject({
      purchaseStatus: "paid",
      entitlementStatus: "active",
      maestroCreditStatus: "available",
      maestroCreditAmountCents: 2_900,
    });
  });

  it("revokes the entitlement and equal credit after a refund", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const evaluated = yield* confect.mutation(
        refs.public.capabilities.evaluateAppIdea.evaluateAppIdea,
        {
          sessionId: "refund_session",
          accessToken: "refund_access",
          answers,
        },
      );
      const verification = yield* confect.action(
        refs.public.capabilities.manageEvaluationReport
          .requestReportEmailVerification,
        {
          reportId: evaluated.reportId,
          accessToken: "refund_access",
          email: "refund@example.test",
        },
      );
      const verificationToken =
        new URL(
          verification.fakeVerificationUrl ?? "",
          "https://example.test",
        ).searchParams.get("token") ?? "";
      const ownership = yield* confect.mutation(
        refs.public.capabilities.manageEvaluationReport
          .consumeReportEmailVerification,
        { verificationToken },
      );
      const checkout = yield* confect.action(
        refs.public.commerce.checkout.create,
        {
          reportId: evaluated.reportId,
          ownerAccessToken: ownership.ownerAccessToken,
          email: "refund@example.test",
        },
      );
      yield* confect.action(refs.public.commerce.webhooks.applyDodo, {
        rawBody: JSON.stringify({
          type: "payment.succeeded",
          data: {
            payment_id: "payment_refund_1",
            checkout_session_id: checkout.checkoutSessionId,
          },
        }),
        webhookId: "event_payment_refund_1",
      });
      yield* confect.action(refs.public.commerce.webhooks.applyDodo, {
        rawBody: JSON.stringify({
          type: "refund.succeeded",
          data: { payment_id: "payment_refund_1" },
        }),
        webhookId: "event_refund_1",
      });
      return yield* confect.query(refs.public.commerce.checkout.status, {
        reportId: evaluated.reportId,
        ownerAccessToken: ownership.ownerAccessToken,
      });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result).toMatchObject({
      purchaseStatus: "refunded",
      entitlementStatus: "revoked",
      maestroCreditStatus: "revoked",
    });
  });
});
