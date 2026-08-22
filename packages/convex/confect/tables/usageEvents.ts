import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    idempotencyKey: Schema.String,
    provider: Schema.Literals(["openrouter", "dodo", "email", "storage"]),
    units: Schema.Number,
    costCredits: Schema.Number,
    entitlementKey: Schema.String,
    createdAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_idempotency", ["idempotencyKey"])
  .index("by_workspace_idempotency", ["workspaceId", "idempotencyKey"])
  .index("by_provider", ["provider"])
  .index("by_entitlement", ["workspaceId", "entitlementKey"]);
