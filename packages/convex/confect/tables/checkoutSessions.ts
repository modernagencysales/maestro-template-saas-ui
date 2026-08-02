import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    checkoutSessionId: Schema.String,
    checkoutUrl: Schema.optional(Schema.String),
    reportId: Schema.String,
    admaxxerVisitorId: Schema.optional(Schema.String),
    idempotencyKey: Schema.String,
    amountCents: Schema.Number,
    currency: Schema.String,
    status: Schema.Literal(
      "created",
      "checkout-open",
      "payment-pending",
      "paid",
      "failed",
      "refunded",
      "disputed",
    ),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_checkout", ["checkoutSessionId"])
  .index("by_idempotency", ["idempotencyKey"])
  .index("by_report", ["reportId"]);
