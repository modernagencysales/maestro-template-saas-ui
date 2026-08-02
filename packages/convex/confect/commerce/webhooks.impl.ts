import { FunctionImpl, GroupImpl } from "@confect/server";
import { verifyDodoWebhook } from "@maestro-template/integrations";
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
import { loadDodoCommerceEnvConfig } from "../evaluator/providerConfig";
import { RuntimeModeConfig } from "../shared/config";
import { sha256Hex } from "../shared/sha256";
import webhooksGroup, { WebhookRejected } from "./webhooks.spec";

const BUILD_PACK_AMOUNT_CENTS = 2_900;
const BUILD_PACK_CURRENCY = "USD" as const;
const PUBLIC_FUNNEL_WORKSPACE = "public-funnel";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

type SupportedEvent = {
  readonly eventType:
    | "payment.succeeded"
    | "payment.failed"
    | "refund.succeeded"
    | "dispute.opened";
  readonly paymentId: string;
  readonly checkoutSessionId?: string;
};

const objectRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const parseSupportedEvent = (rawBody: string): SupportedEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const event = objectRecord(parsed);
  const data = objectRecord(event?.data);
  const eventType = event?.type;
  const paymentId = data?.payment_id;
  if (
    (eventType !== "payment.succeeded" &&
      eventType !== "payment.failed" &&
      eventType !== "refund.succeeded" &&
      eventType !== "dispute.opened") ||
    typeof paymentId !== "string" ||
    !paymentId.trim()
  )
    return null;
  const checkoutSessionId = data?.checkout_session_id;
  return {
    eventType,
    paymentId: paymentId.trim(),
    ...(typeof checkoutSessionId === "string" && checkoutSessionId.trim()
      ? { checkoutSessionId: checkoutSessionId.trim() }
      : {}),
  };
};

const applyRevocation = (
  event: Extract<SupportedEvent, { readonly eventType: string }>,
  eventId: string,
  now: number,
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const incomingStatus =
      event.eventType === "dispute.opened"
        ? ("disputed" as const)
        : ("refunded" as const);
    const existingRevocation = yield* reader
      .table("commerceRevocations")
      .index("by_payment", (q) => q.eq("paymentId", event.paymentId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (existingRevocation === null)
      yield* writer
        .table("commerceRevocations")
        .insert({
          paymentId: event.paymentId,
          eventId,
          status: incomingStatus,
          createdAt: now,
        })
        .pipe(Effect.orDie);
    else if (
      existingRevocation.status !== "disputed" &&
      incomingStatus === "disputed"
    )
      yield* writer
        .table("commerceRevocations")
        .patch(existingRevocation._id, { eventId, status: "disputed" })
        .pipe(Effect.orDie);
    const status =
      existingRevocation?.status === "disputed"
        ? ("disputed" as const)
        : incomingStatus;

    const purchase = yield* reader
      .table("purchases")
      .index("by_payment", (q) => q.eq("paymentId", event.paymentId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (purchase === null) return;
    yield* writer
      .table("purchases")
      .patch(purchase._id, { status, updatedAt: now })
      .pipe(Effect.orDie);

    const entitlement = yield* reader
      .table("buildPackEntitlements")
      .index("by_purchase", (q) => q.eq("purchaseId", purchase.purchaseId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (entitlement !== null)
      yield* writer
        .table("buildPackEntitlements")
        .patch(entitlement._id, { status: "revoked", updatedAt: now })
        .pipe(Effect.orDie);
    const credit = yield* reader
      .table("maestroCredits")
      .index("by_purchase", (q) => q.eq("purchaseId", purchase.purchaseId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (credit !== null)
      yield* writer
        .table("maestroCredits")
        .patch(credit._id, { status: "revoked", updatedAt: now })
        .pipe(Effect.orDie);

    const checkout = purchase.checkoutSessionId
      ? yield* reader
          .table("checkoutSessions")
          .index("by_checkout", (q) =>
            q.eq("checkoutSessionId", purchase.checkoutSessionId ?? ""),
          )
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie)
      : yield* reader
          .table("checkoutSessions")
          .index("by_report", (q) => q.eq("reportId", purchase.reportId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (checkout !== null)
      yield* writer
        .table("checkoutSessions")
        .patch(checkout._id, { status, updatedAt: now })
        .pipe(Effect.orDie);
  });

const applyPayment = (event: SupportedEvent, now: number) =>
  Effect.gen(function* () {
    if (!event.checkoutSessionId)
      return yield* new WebhookRejected({
        reason: "payment event is missing checkout_session_id",
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

const applyVerifiedDodoImpl = FunctionImpl.make(
  databaseSchema,
  webhooksGroup,
  "applyVerifiedDodo",
  ({ rawBody, eventId, signatureTimestamp }) =>
    Effect.gen(function* () {
      const normalizedEventId = eventId.trim();
      if (!normalizedEventId)
        return yield* new ValidationFailed({
          field: "webhookId",
          message: "webhook-id must not be blank.",
        });
      const event = parseSupportedEvent(rawBody);
      if (event === null)
        return yield* new WebhookRejected({
          reason: "unsupported or malformed Dodo event",
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const dedupeKey = `dodo.${normalizedEventId}`;
      const duplicate = yield* reader
        .table("webhookEvents")
        .index("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (duplicate !== null)
        return { eventId: normalizedEventId, status: "duplicate" as const };

      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      yield* writer
        .table("webhookEvents")
        .insert({
          workspaceId: PUBLIC_FUNNEL_WORKSPACE,
          provider: "dodo",
          eventId: normalizedEventId,
          eventType: event.eventType,
          signatureTimestamp,
          dedupeKey,
          status: "processed",
          createdAt: now,
        })
        .pipe(Effect.orDie);

      if (
        event.eventType === "refund.succeeded" ||
        event.eventType === "dispute.opened"
      )
        yield* applyRevocation(event, normalizedEventId, now);
      else yield* applyPayment(event, now);

      return { eventId: normalizedEventId, status: "processed" as const };
    }),
);

const applyDodoImpl = FunctionImpl.make(
  databaseSchema,
  webhooksGroup,
  "applyDodo",
  ({ rawBody, webhookId, signature, signatureTimestamp }) =>
    Effect.gen(function* () {
      const runtimeMode = yield* RuntimeModeConfig.pipe(
        Effect.mapError(
          () =>
            new ConfigInvalid({
              provider: "dodo",
              message: "TEMPLATE_RUNTIME_MODE is invalid.",
            }),
        ),
      );
      const dodoEnv = yield* loadDodoCommerceEnvConfig.pipe(Effect.orDie);
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const verification = yield* Effect.promise(() =>
        verifyDodoWebhook({
          mode: runtimeMode,
          payload: rawBody,
          signature,
          signatureTimestamp,
          webhookId,
          webhookSecret: dodoEnv.DODO_WEBHOOK_SECRET,
          nowMs: now,
          seenEventIds: [],
          seenWebhookKeys: [],
        }),
      );
      if (!("ok" in verification)) {
        if (verification._tag === "DodoWebhookConfigError")
          return yield* new ConfigInvalid({
            provider: "dodo",
            message: "Dodo webhook configuration is incomplete.",
          });
        return yield* new WebhookRejected({
          reason:
            verification._tag === "DodoWebhookPayloadError"
              ? "invalid payload"
              : "signature verification failed",
        });
      }

      const mutation = yield* MutationRunner;
      return yield* mutation(
        refs.internal.commerce.webhooks.applyVerifiedDodo,
        {
          rawBody,
          eventId: verification.eventId,
          signatureTimestamp: signatureTimestamp?.trim() || "fake",
        },
      ).pipe(
        Effect.catchTag(
          "SchemaError",
          () => new WebhookRejected({ reason: "invalid verified event" }),
        ),
      );
    }),
);

export default GroupImpl.make(databaseSchema, webhooksGroup).pipe(
  Layer.provide(applyDodoImpl),
  Layer.provide(applyVerifiedDodoImpl),
  GroupImpl.finalize,
);
