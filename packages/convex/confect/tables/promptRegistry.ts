import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    ref: Schema.String,
    family: Schema.String,
    version: Schema.Number,
    status: Schema.Literals(["draft", "active", "retired"]),
    modelRef: Schema.String,
    body: Schema.String,
    bodyHash: Schema.String,
    createdAt: Schema.Number,
    retiredAt: Schema.NullOr(Schema.Number),
  }),
)
  .index("by_ref", ["ref"])
  .index("by_family_version", ["family", "version"])
  .index("by_family_status", ["family", "status"]);
