import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    packId: Schema.String,
    version: Schema.Number,
    format: Schema.Literals(["markdown", "print-html"]),
    objectKey: Schema.String,
    contentHash: Schema.String,
    createdAt: Schema.Number,
  }),
)
  .index("by_pack", ["packId"])
  .index("by_pack_version", ["packId", "version"]);
