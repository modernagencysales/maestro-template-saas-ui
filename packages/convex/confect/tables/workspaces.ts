import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Schema.String,
    ownerUserId: Schema.String,
    slug: Schema.String,
    name: Schema.String,
    status: Schema.Literals(["active", "archived"]),
    dataClassification: Schema.Literals(["public", "internal", "confidential"]),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_slug", ["slug"])
  .index("by_organization", ["organizationId"])
  .index("by_owner", ["ownerUserId"]);
