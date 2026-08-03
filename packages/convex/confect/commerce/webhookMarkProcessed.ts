import { FunctionImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { ValidationFailed } from "../errors";
import webhooksGroup, { WebhookRejected } from "./webhooks.spec";

export default FunctionImpl.make(
  databaseSchema,
  webhooksGroup,
  "markProcessed",
  ({ eventId }) =>
    Effect.gen(function* () {
      const normalized = eventId.trim();
      if (!normalized)
        return yield* new ValidationFailed({
          field: "eventId",
          message: "eventId must not be blank.",
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const event = yield* reader
        .table("webhookEvents")
        .index("by_provider_event", (q) =>
          q.eq("provider", "dodo").eq("eventId", normalized),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (event === null)
        return yield* new WebhookRejected({
          reason: "webhook event is not persisted",
        });
      if (event.status === "processed" && event.attributionPending !== true)
        return true;
      yield* writer
        .table("webhookEvents")
        .patch(event._id, { status: "processed", attributionPending: false })
        .pipe(Effect.orDie);
      return true;
    }),
);
