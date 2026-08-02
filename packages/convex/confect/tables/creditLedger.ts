import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    type: Schema.Literals(["credit", "debit"]),
    credits: Schema.Number,
    reason: Schema.Literals([
      "manual_adjustment",
      "llm_usage",
      "seat_charge",
      "refund",
    ]),
    idempotencyKey: Schema.String,
    appendOnly: Schema.Literal(true),
    createdAt: Schema.Number,
    createdBy: Schema.String,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_idempotency", ["idempotencyKey"])
  .index("by_workspace_idempotency", ["workspaceId", "idempotencyKey"])
  .index("by_workspace_created", ["workspaceId", "createdAt"])
  .index("by_append_only", ["workspaceId", "appendOnly"]);
