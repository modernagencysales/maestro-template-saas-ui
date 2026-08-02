import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    entityKey: Schema.String,
    versionKey: Schema.String,
    priorVersionKey: Schema.optional(Schema.String),
    restoredFromVersionKey: Schema.optional(Schema.String),
    externalVersion: Schema.optional(Schema.String),
    reconciliationKey: Schema.optional(Schema.String),
    causation: Schema.Literals([
      "human-edit",
      "agent-edit",
      "import",
      "migration",
      "reconcile",
      "restore",
    ]),
    actorId: Schema.String,
    payloadHash: Schema.String,
    payloadJson: Schema.String,
    idempotencyKey: Schema.String,
    appendOnly: Schema.Boolean,
    createdAt: Schema.Number,
  }),
)
  .index("by_entity", ["workspaceId", "entityKey"])
  .index("by_entity_version", ["workspaceId", "entityKey", "versionKey"])
  .index("by_reconciliation", [
    "workspaceId",
    "entityKey",
    "reconciliationKey",
  ]);
