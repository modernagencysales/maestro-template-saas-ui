import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    checkoutSessionId: Schema.String,
    reportId: Schema.String,
    idempotencyKey: Schema.String,
    amountCents: Schema.Number,
    currency: Schema.String,
    status: Schema.Literal("created", "payment-pending", "paid", "failed"),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_checkout", ["checkoutSessionId"])
  .index("by_idempotency", ["idempotencyKey"])
  .index("by_report", ["reportId"]);
