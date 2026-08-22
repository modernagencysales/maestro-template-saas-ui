import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { sha256Hex } from "../shared/sha256";
import type { SupportedEvent } from "./webhookEvent";
import { WebhookRejected } from "./webhooks.spec";

const BUILD_PACK_AMOUNT_CENTS = 2_900;
const BUILD_PACK_CURRENCY = "USD" as const;

type ExpectedPayment = {
  readonly productId?: string;
  readonly amountCents?: number;
  readonly currency?: string;
};

type Checkout = {
  readonly _id: GenericId<"checkoutSessions">;
  readonly checkoutSessionId: string;
  readonly reportId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly status: string;
};

const paymentValidationFailure = (
  event: SupportedEvent,
  expected: ExpectedPayment,
): WebhookRejected | undefined => {
  const checks: readonly (readonly [boolean, string])[] = [
    [
      Boolean(event.checkoutSessionId),
      "payment event is missing checkout_session_id",
    ],
    [
      expected.productId === undefined ||
        event.productId === expected.productId,
      "payment product mismatch",
    ],
    [
      expected.amountCents === undefined ||
        event.amountCents === expected.amountCents,
      "payment amount mismatch",
    ],
    [
      expected.currency === undefined || event.currency === expected.currency,
      "payment currency mismatch",
    ],
  ];
  const reason = checks.find(([valid]) => !valid)?.[1];
  return reason ? new WebhookRejected({ reason }) : undefined;
};

const applyFailedPayment = (checkout: Checkout, now: number) =>
  Effect.gen(function* () {
    const protectedStatus =
      checkout.status === "paid" ||
      checkout.status === "refunded" ||
      checkout.status === "disputed";
    if (protectedStatus) return;
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("checkoutSessions")
      .patch(checkout._id, { status: "failed", updatedAt: now })
      .pipe(Effect.orDie);
  });

type GrantInput<Status extends string> = {
  readonly reportId: string;
  readonly purchaseId: string;
  readonly status: Status;
  readonly revoked: boolean;
  readonly now: number;
};

const paymentStatuses = (
  revocationStatus: "refunded" | "disputed" | undefined,
  existingStatus: string | undefined,
) => {
  const retainedRevocation =
    existingStatus === "refunded" || existingStatus === "disputed"
      ? existingStatus
      : null;
  const revokedStatus = revocationStatus ?? retainedRevocation;
  return {
    revokedStatus,
    purchaseStatus: revokedStatus ?? ("paid" as const),
    grantStatus:
      revokedStatus === null ? ("active" as const) : ("revoked" as const),
    creditStatus:
      revokedStatus === null ? ("available" as const) : ("revoked" as const),
  };
};

const purchaseConflicts = (input: {
  readonly exists: boolean;
  readonly existingReportId: string | undefined;
  readonly existingCheckoutId: string | undefined;
  readonly reportId: string;
  readonly checkoutId: string;
}): boolean =>
  input.exists &&
  (input.existingReportId !== input.reportId ||
    input.existingCheckoutId !== input.checkoutId);

const persistEntitlement = (input: GrantInput<"active" | "revoked">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const row = yield* reader
      .table("buildPackEntitlements")
      .index("by_report", (q) => q.eq("reportId", input.reportId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (row === null)
      yield* writer
        .table("buildPackEntitlements")
        .insert({
          reportId: input.reportId,
          purchaseId: input.purchaseId,
          status: input.status,
          generationAttempts: 0,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .pipe(Effect.orDie);
    else if (row.purchaseId === input.purchaseId && input.revoked)
      yield* writer
        .table("buildPackEntitlements")
        .patch(row._id, { status: input.status, updatedAt: input.now })
        .pipe(Effect.orDie);
  });

const persistCredit = (input: GrantInput<"available" | "revoked">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const row = yield* reader
      .table("maestroCredits")
      .index("by_report", (q) => q.eq("reportId", input.reportId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (row === null)
      yield* writer
        .table("maestroCredits")
        .insert({
          reportId: input.reportId,
          purchaseId: input.purchaseId,
          amountCents: BUILD_PACK_AMOUNT_CENTS,
          currency: BUILD_PACK_CURRENCY,
          status: input.status,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .pipe(Effect.orDie);
    else if (row.purchaseId === input.purchaseId && input.revoked)
      yield* writer
        .table("maestroCredits")
        .patch(row._id, { status: input.status, updatedAt: input.now })
        .pipe(Effect.orDie);
  });

const applySuccessfulPayment = (
  event: SupportedEvent,
  checkout: Checkout,
  now: number,
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const revocation = yield* reader
      .table("commerceRevocations")
      .index("by_payment", (q) => q.eq("paymentId", event.paymentId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    const purchaseId = `purchase_${sha256Hex(event.paymentId).slice(0, 24)}`;
    const existingPurchase = yield* reader
      .table("purchases")
      .index("by_payment", (q) => q.eq("paymentId", event.paymentId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (
      purchaseConflicts({
        exists: existingPurchase !== null,
        existingReportId: existingPurchase?.reportId,
        existingCheckoutId: existingPurchase?.checkoutSessionId,
        reportId: checkout.reportId,
        checkoutId: checkout.checkoutSessionId,
      })
    )
      return yield* new WebhookRejected({
        reason: "payment id is already bound to another checkout",
      });
    const { revokedStatus, purchaseStatus, grantStatus, creditStatus } =
      paymentStatuses(revocation?.status, existingPurchase?.status);
    if (existingPurchase === null)
      yield* writer
        .table("purchases")
        .insert({
          purchaseId,
          paymentId: event.paymentId,
          checkoutSessionId: checkout.checkoutSessionId,
          reportId: checkout.reportId,
          ...(event.admaxxerVisitorId
            ? { admaxxerVisitorId: event.admaxxerVisitorId }
            : {}),
          amountCents: checkout.amountCents,
          currency: checkout.currency,
          status: purchaseStatus,
          createdAt: now,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
    else if (revokedStatus !== null)
      yield* writer
        .table("purchases")
        .patch(existingPurchase._id, { status: purchaseStatus, updatedAt: now })
        .pipe(Effect.orDie);
    const grant = {
      reportId: checkout.reportId,
      purchaseId,
      revoked: revokedStatus !== null,
      now,
    };
    yield* persistEntitlement({ ...grant, status: grantStatus });
    yield* persistCredit({ ...grant, status: creditStatus });
    yield* writer
      .table("checkoutSessions")
      .patch(checkout._id, { status: purchaseStatus, updatedAt: now })
      .pipe(Effect.orDie);
  });

export const applyPayment = (
  event: SupportedEvent,
  now: number,
  expected: ExpectedPayment,
) =>
  Effect.gen(function* () {
    const failure = paymentValidationFailure(event, expected);
    if (failure) return yield* failure;
    const reader = yield* DatabaseReader;
    const checkout = yield* reader
      .table("checkoutSessions")
      .index("by_checkout", (q) =>
        q.eq("checkoutSessionId", event.checkoutSessionId ?? ""),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (checkout === null)
      return yield* new WebhookRejected({
        reason: "payment event does not match a stored checkout",
      });
    if (event.eventType === "payment.failed")
      return yield* applyFailedPayment(checkout, now);
    return yield* applySuccessfulPayment(event, checkout, now);
  });
