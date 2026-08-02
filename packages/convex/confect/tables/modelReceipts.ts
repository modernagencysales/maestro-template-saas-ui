import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    receiptId: Schema.String,
    sessionId: Schema.String,
    reportId: Schema.String,
    tier: Schema.Literal("free", "premium"),
    stage: Schema.String,
    provider: Schema.String,
    mode: Schema.Literal("fake", "test", "live"),
    model: Schema.String,
    repair: Schema.Boolean,
    inputTokens: Schema.Number,
    outputTokens: Schema.Number,
    estimatedCents: Schema.Number,
    generatedAt: Schema.Number,
  }),
)
  .index("by_receipt", ["receiptId"])
  .index("by_session", ["sessionId"])
  .index("by_report", ["reportId"])
  .index("by_generated_at", ["generatedAt"]);
