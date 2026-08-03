import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { ValidationFailed } from "../errors";
import webhooksGroup, { WebhookRejected } from "./webhooks.spec";

export { validateLiveDodoBindings } from "./webhookEvent";
export { applyPayment } from "./webhookPayment";

import applyVerifiedDodoImpl from "./webhookApplyVerified";

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

import markProcessedImpl from "./webhookMarkProcessed";

import applyDodoImpl from "./webhookApplyDodo";

export default GroupImpl.make(databaseSchema, webhooksGroup).pipe(
  Layer.provide(applyDodoImpl),
  Layer.provide(applyVerifiedDodoImpl),
  Layer.provide(markAdmaxxerReportedImpl),
  Layer.provide(markProcessedImpl),
  GroupImpl.finalize,
);
