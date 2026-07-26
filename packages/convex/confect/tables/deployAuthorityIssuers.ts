import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    issuerId: Schema.String,
    publicKeyHash: Schema.String,
    publicKeySpki: Schema.String,
    enabled: Schema.Boolean,
  }),
).index("by_issuer", ["issuerId"]);
