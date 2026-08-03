import { FunctionImpl, GroupImpl } from "@confect/server";
import {
  recordAdmaxxerPayment,
  verifyDodoWebhook,
} from "@maestro-template/integrations";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
} from "../_generated/services";
import { ConfigInvalid, ValidationFailed } from "../errors";
import {
  loadAdmaxxerEnvConfig,
  loadDodoCommerceEnvConfig,
} from "../evaluator/providerConfig";
import { RuntimeModeConfig } from "../shared/config";
import { sha256Hex } from "../shared/sha256";
import webhooksGroup, { WebhookRejected } from "./webhooks.spec";

const BUILD_PACK_AMOUNT_CENTS = 2_900;
const BUILD_PACK_CURRENCY = "USD" as const;
const PUBLIC_FUNNEL_WORKSPACE = "public-funnel";

export { validateLiveDodoBindings } from "./webhookEvent";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

import {
  parseSupportedEvent,
  validateLiveDodoBindings,
  type SupportedEvent,
} from "./webhookEvent";

import { applyRevocation } from "./webhookRevocation";

export const applyPayment = (
  event: SupportedEvent,
  now: number,
  expected: {
    readonly productId?: string;
    readonly amountCents?: number;
    readonly currency?: string;
  },
) =>
  Effect.gen(function* () {
    if (!event.checkoutSessionId)
      return yield* new WebhookRejected({
        reason: "payment event is missing checkout_session_id",
      });
    if (expected.productId && event.productId !== expected.productId)
      return yield* new WebhookRejected({ reason: "payment product mismatch" });
    if (
      expected.amountCents !== undefined &&
      event.amountCents !== expected.amountCents
    )
      return yield* new WebhookRejected({ reason: "payment amount mismatch" });
    if (expected.currency && event.currency !== expected.currency)
      return yield* new WebhookRejected({
        reason: "payment currency mismatch",
      });
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
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
    if (event.eventType === "payment.failed") {
      if (
        checkout.status !== "paid" &&
        checkout.status !== "refunded" &&
        checkout.status !== "disputed"
      )
        yield* writer
          .table("checkoutSessions")
          .patch(checkout._id, { status: "failed", updatedAt: now })
          .pipe(Effect.orDie);
      return;
    }

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
      existingPurchase !== null &&
      (existingPurchase.reportId !== checkout.reportId ||
        existingPurchase.checkoutSessionId !== checkout.checkoutSessionId)
    )
      return yield* new WebhookRejected({
        reason: "payment id is already bound to another checkout",
      });
    const revokedStatus =
      revocation?.status ??
      (existingPurchase?.status === "refunded" ||
      existingPurchase?.status === "disputed"
        ? existingPurchase.status
        : null);
    const purchaseStatus = revokedStatus ?? ("paid" as const);
    const grantStatus =
      revokedStatus === null ? ("active" as const) : ("revoked" as const);
    const creditStatus =
      revokedStatus === null ? ("available" as const) : ("revoked" as const);
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

    const entitlement = yield* reader
      .table("buildPackEntitlements")
      .index("by_report", (q) => q.eq("reportId", checkout.reportId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (entitlement === null)
      yield* writer
        .table("buildPackEntitlements")
        .insert({
          reportId: checkout.reportId,
          purchaseId,
          status: grantStatus,
          generationAttempts: 0,
          createdAt: now,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
    else if (entitlement.purchaseId === purchaseId && revokedStatus !== null)
      yield* writer
        .table("buildPackEntitlements")
        .patch(entitlement._id, { status: grantStatus, updatedAt: now })
        .pipe(Effect.orDie);

    const credit = yield* reader
      .table("maestroCredits")
      .index("by_report", (q) => q.eq("reportId", checkout.reportId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (credit === null)
      yield* writer
        .table("maestroCredits")
        .insert({
          reportId: checkout.reportId,
          purchaseId,
          amountCents: BUILD_PACK_AMOUNT_CENTS,
          currency: BUILD_PACK_CURRENCY,
          status: creditStatus,
          createdAt: now,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
    else if (credit.purchaseId === purchaseId && revokedStatus !== null)
      yield* writer
        .table("maestroCredits")
        .patch(credit._id, { status: creditStatus, updatedAt: now })
        .pipe(Effect.orDie);

    yield* writer
      .table("checkoutSessions")
      .patch(checkout._id, { status: purchaseStatus, updatedAt: now })
      .pipe(Effect.orDie);
  });

import applyVerifiedDodoImpl from "./webhookApplyVerified.impl";

const markAdmaxxerReportedImpl = FunctionImpl.make(
  databaseSchema,
  webhooksGroup,
  "markAdmaxxerReported",
  ({ paymentId, reportedAt }) =>
    Effect.gen(function* () {
      const normalized = paymentId.trim();
      if (!normalized || !Number.isFinite(reportedAt))
        return yield* new ValidationFailed({
          field: "paymentId",
          message: "A payment ID and timestamp are required.",
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const purchase = yield* reader
        .table("purchases")
        .index("by_payment", (q) => q.eq("paymentId", normalized))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (purchase === null)
        return yield* new WebhookRejected({
          reason: "payment is not persisted",
        });
      if (purchase.admaxxerReportedAt !== undefined) return false;
      yield* writer
        .table("purchases")
        .patch(purchase._id, {
          admaxxerReportedAt: reportedAt,
          updatedAt: reportedAt,
        })
        .pipe(Effect.orDie);
      return true;
    }),
);

import markProcessedImpl from "./webhookMarkProcessed.impl";

import applyDodoImpl from "./webhookApplyDodo.impl";

export default GroupImpl.make(databaseSchema, webhooksGroup).pipe(
  Layer.provide(applyDodoImpl),
  Layer.provide(applyVerifiedDodoImpl),
  Layer.provide(markAdmaxxerReportedImpl),
  Layer.provide(markProcessedImpl),
  GroupImpl.finalize,
);
