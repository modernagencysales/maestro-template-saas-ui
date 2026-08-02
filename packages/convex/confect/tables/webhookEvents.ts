import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    provider: Schema.Literal("dodo"),
    eventId: Schema.String,
    eventType: Schema.String,
    signatureTimestamp: Schema.String,
    dedupeKey: Schema.String,
    status: Schema.Literals(["processed", "duplicate", "failed"]),
    attributionPending: Schema.optional(Schema.Boolean),
    createdAt: Schema.Number,
  }),
)
  .index("by_provider_event", ["provider", "eventId", "signatureTimestamp"])
  .index("by_dedupe_key", ["dedupeKey"])
  .index("by_workspace_dedupe_key", ["workspaceId", "dedupeKey"])
  .index("by_workspace", ["workspaceId"]);
