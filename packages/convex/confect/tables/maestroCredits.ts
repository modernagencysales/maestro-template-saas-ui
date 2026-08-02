import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    reportId: Schema.String,
    purchaseId: Schema.String,
    amountCents: Schema.Number,
    currency: Schema.String,
    status: Schema.Literals(["available", "applied", "revoked"]),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_report", ["reportId"])
  .index("by_purchase", ["purchaseId"]);
