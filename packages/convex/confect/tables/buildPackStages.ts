import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    packId: Schema.String,
    stageName: Schema.String,
    status: Schema.Literals([
      "queued",
      "running",
      "completed",
      "failed-recoverable",
      "needs-support",
    ]),
    attempts: Schema.Number,
    outputJson: Schema.optional(Schema.String),
    errorCode: Schema.optional(Schema.String),
    estimatedCostCents: Schema.Number,
    leaseId: Schema.optional(Schema.String),
    leaseExpiresAt: Schema.optional(Schema.Number),
    updatedAt: Schema.Number,
  }),
)
  .index("by_pack", ["packId"])
  .index("by_pack_stage", ["packId", "stageName"]);
