import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Id("workspaces"),
    title: Schema.String,
    detail: Schema.String,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
).index("by_workspace", ["workspaceId"]);
