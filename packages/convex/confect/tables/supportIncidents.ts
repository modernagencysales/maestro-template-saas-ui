import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    incidentId: Schema.String,
    packId: Schema.String,
    purchaseId: Schema.String,
    failedStage: Schema.String,
    status: Schema.Literal("recoverable", "needs-support", "resumed", "closed"),
    operatorReason: Schema.optional(Schema.String),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_incident", ["incidentId"])
  .index("by_pack", ["packId"]);
