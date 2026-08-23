import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";
import {
  providerConnectionStatuses,
  providerKeys,
} from "../integrations/connectionLifecycle";

// Workspace provider authorization and redacted connection status
export default Table.make(() =>
  Schema.Struct({
    workspaceId: Id("workspaces"),
    provider: Schema.Literals(providerKeys),
    status: Schema.Literals(providerConnectionStatuses),
    generation: Schema.Number,
    connectionRef: Schema.optional(Schema.NonEmptyString),
    errorCode: Schema.optional(Schema.NonEmptyString),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_and_provider", ["workspaceId", "provider"])
  .index("by_workspace_and_status", ["workspaceId", "status"]);
