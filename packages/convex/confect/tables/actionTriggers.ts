import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    triggerId: Schema.String,
    actionKind: Schema.Literals(["refresh", "publish", "sync"]),
    schedule: Schema.String,
    capabilityId: Schema.String,
    configHash: Schema.String,
    enabled: Schema.Boolean,
    idempotencyKey: Schema.String,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_capability", ["workspaceId", "capabilityId"])
  .index("by_idempotency_key", ["workspaceId", "idempotencyKey"]);
