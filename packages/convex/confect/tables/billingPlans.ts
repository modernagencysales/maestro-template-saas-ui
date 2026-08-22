import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Schema.String,
    providerCustomerId: Schema.optional(Schema.String),
    planSlug: Schema.String,
    status: Schema.Literals([
      "fake",
      "trialing",
      "active",
      "past_due",
      "cancelled",
    ]),
    seatLimit: Schema.Number,
    monthlyCredits: Schema.Number,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_status", ["workspaceId", "status"]);
