import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    entitlementKey: Schema.String,
    featureKey: Schema.String,
    limit: Schema.Number,
    used: Schema.Number,
    source: Schema.Literals(["fake", "dodo", "manual"]),
    status: Schema.Literals(["active", "paused", "revoked"]),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_feature", ["workspaceId", "featureKey"])
  .index("by_workspace_entitlement", ["workspaceId", "entitlementKey"]);
