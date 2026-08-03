import { FunctionImpl } from "@confect/server";
import {
  recordAdmaxxerPayment,
  verifyDodoWebhook,
} from "@maestro-template/integrations";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import { MutationRunner } from "../_generated/services";
import { ConfigInvalid } from "../errors";
import {
  loadAdmaxxerEnvConfig,
  loadDodoCommerceEnvConfig,
} from "../evaluator/providerConfig";
import { RuntimeModeConfig } from "../shared/config";
import { parseSupportedEvent } from "./webhookEvent";
import webhooksGroup, { WebhookRejected } from "./webhooks.spec";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

export default FunctionImpl.make(
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
      const result = yield* mutation(
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
      const event = parseSupportedEvent(rawBody);
      if (event?.eventType === "payment.succeeded") {
        const admaxxer = yield* loadAdmaxxerEnvConfig.pipe(Effect.orDie);
        if (runtimeMode === "live" && !admaxxer.ADMAXXER_API_KEY)
          return yield* new ConfigInvalid({
            provider: "admaxxer",
            message: "Admaxxer attribution is not configured.",
          });
        if (runtimeMode === "live" && event.amountCents === undefined)
          return yield* new WebhookRejected({
            reason: "payment event is missing total_amount",
          });
        if (admaxxer.ADMAXXER_API_KEY && event.amountCents !== undefined) {
          yield* Effect.tryPromise({
            try: () =>
              recordAdmaxxerPayment(
                {
                  paymentId: event.paymentId,
                  amountMinor: event.amountCents as number,
                  currency: event.currency ?? "USD",
                  ...(event.admaxxerVisitorId
                    ? { visitorId: event.admaxxerVisitorId }
                    : {}),
                  ...(event.email ? { email: event.email } : {}),
                },
                { apiKey: admaxxer.ADMAXXER_API_KEY },
              ),
            catch: () =>
              new WebhookRejected({
                reason: "Admaxxer attribution failed; retry the webhook",
              }),
          });
          yield* mutation(
            refs.internal.commerce.webhooks.markAdmaxxerReported,
            { paymentId: event.paymentId, reportedAt: now },
          ).pipe(
            Effect.catchTag(
              "SchemaError",
              () =>
                new WebhookRejected({ reason: "invalid attribution receipt" }),
            ),
          );
        }
      }
      yield* mutation(refs.internal.commerce.webhooks.markProcessed, {
        eventId: verification.eventId,
      }).pipe(
        Effect.catchTag(
          "SchemaError",
          () => new WebhookRejected({ reason: "invalid webhook receipt" }),
        ),
      );
      return result;
    }),
);
