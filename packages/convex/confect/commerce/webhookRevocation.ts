import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import type { SupportedEvent } from "./webhookEvent";

export const applyRevocation = (
  event: SupportedEvent,
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
