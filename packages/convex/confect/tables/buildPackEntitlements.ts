import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    reportId: Schema.String,
    purchaseId: Schema.String,
    status: Schema.Literal("active", "revoked"),
    generationAttempts: Schema.Number,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_report", ["reportId"])
  .index("by_purchase", ["purchaseId"]);
