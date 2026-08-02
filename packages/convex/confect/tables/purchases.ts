import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    purchaseId: Schema.String,
    paymentId: Schema.String,
    checkoutSessionId: Schema.optional(Schema.String),
    reportId: Schema.String,
    admaxxerVisitorId: Schema.optional(Schema.String),
    admaxxerReportedAt: Schema.optional(Schema.Number),
    amountCents: Schema.Number,
    currency: Schema.String,
    status: Schema.Literal("paid", "refunded", "disputed"),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_purchase", ["purchaseId"])
  .index("by_payment", ["paymentId"])
  .index("by_checkout", ["checkoutSessionId"])
  .index("by_report", ["reportId"]);
