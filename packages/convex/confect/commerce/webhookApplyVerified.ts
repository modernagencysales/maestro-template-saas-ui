import { FunctionImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { ValidationFailed } from "../errors";
import { loadDodoCommerceEnvConfig } from "../evaluator/providerConfig";
import { RuntimeModeConfig } from "../shared/config";
import { applyPayment } from "./webhookPayment";
import { parseSupportedEvent, validateLiveDodoBindings } from "./webhookEvent";
import { applyRevocation } from "./webhookRevocation";
import webhooksGroup, { WebhookRejected } from "./webhooks.spec";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

export default FunctionImpl.make(
  databaseSchema,
  webhooksGroup,
  "applyVerifiedDodo",
  ({ rawBody, eventId, signatureTimestamp }) =>
    Effect.gen(function* () {
      const runtimeMode = yield* RuntimeModeConfig.pipe(
        Effect.orElseSucceed(() => "fake" as const),
      );
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
      const dodoEnv = yield* loadDodoCommerceEnvConfig.pipe(Effect.orDie);
      if (
        runtimeMode === "live" &&
        !validateLiveDodoBindings({
          ...(dodoEnv.DODO_BUILD_PACK_PRODUCT_ID
            ? { productId: dodoEnv.DODO_BUILD_PACK_PRODUCT_ID }
            : {}),
          ...(dodoEnv.DODO_BUILD_PACK_EXPECTED_AMOUNT_CENTS
            ? { amountCents: dodoEnv.DODO_BUILD_PACK_EXPECTED_AMOUNT_CENTS }
            : {}),
          ...(dodoEnv.DODO_BUILD_PACK_EXPECTED_CURRENCY
            ? { currency: dodoEnv.DODO_BUILD_PACK_EXPECTED_CURRENCY }
            : {}),
        })
      )
        return yield* new WebhookRejected({
          reason:
            "live Dodo product, amount, and currency bindings are incomplete",
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const dedupeKey = `dodo.${normalizedEventId}`;
      const duplicate = yield* reader
        .table("webhookEvents")
        .index("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (
        duplicate !== null &&
        duplicate.status === "processed" &&
        duplicate.attributionPending !== true
      )
        return { eventId: normalizedEventId, status: "duplicate" as const };
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      if (duplicate === null)
        yield* writer
          .table("webhookEvents")
          .insert({
            workspaceId: "public-funnel",
            provider: "dodo",
            eventId: normalizedEventId,
            eventType: event.eventType,
            signatureTimestamp,
            dedupeKey,
            status: "processed",
            attributionPending: event.eventType === "payment.succeeded",
            createdAt: now,
          })
          .pipe(Effect.orDie);
      if (
        event.eventType === "refund.succeeded" ||
        event.eventType === "dispute.opened"
      )
        yield* applyRevocation(event, normalizedEventId, now);
      else
        yield* applyPayment(
          event,
          now,
          runtimeMode === "live"
            ? {
                productId: dodoEnv.DODO_BUILD_PACK_PRODUCT_ID as string,
                amountCents: Number(
                  dodoEnv.DODO_BUILD_PACK_EXPECTED_AMOUNT_CENTS,
                ),
                currency:
                  dodoEnv.DODO_BUILD_PACK_EXPECTED_CURRENCY?.trim().toUpperCase() as string,
              }
            : {},
        );
      return { eventId: normalizedEventId, status: "processed" as const };
    }),
);
