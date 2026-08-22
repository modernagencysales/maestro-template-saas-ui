import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    issuerId: Schema.String,
    publicKeyHash: Schema.String,
    publicKeySpki: Schema.String,
    enabled: Schema.Boolean,
    transition: Schema.optional(
      Schema.Literals(["activate", "rotate", "retire"]),
    ),
    previousPublicKeyHash: Schema.optional(Schema.NullOr(Schema.String)),
    authorityOrigin: Schema.optional(Schema.String),
    activatedAt: Schema.optional(Schema.Number),
    retiredAt: Schema.optional(Schema.NullOr(Schema.Number)),
    provisionedAt: Schema.optional(Schema.Number),
    provisionedByHash: Schema.optional(Schema.String),
    provenanceHash: Schema.optional(Schema.String),
  }),
)
  .index("by_issuer", ["issuerId"])
  .index("by_public_key_hash", ["publicKeyHash"]);
