import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    environment: Schema.Literals(["staging", "production"]),
    targetId: Schema.String,
    commitSha: Schema.String,
    issuerId: Schema.String,
    issuerPublicKeyHash: Schema.optional(Schema.String),
    authorityOrigin: Schema.optional(Schema.String),
    approvalHash: Schema.String,
    verdictHash: Schema.String,
    censusSnapshotId: Schema.String,
    signature: Schema.String,
    issuedAt: Schema.optional(Schema.Number),
    expiresAt: Schema.Number,
    provisionedAt: Schema.optional(Schema.Number),
    provisionedByHash: Schema.optional(Schema.String),
    provenanceHash: Schema.optional(Schema.String),
  }),
)
  .index("by_scope", ["environment", "targetId", "commitSha"])
  .index("by_scope_approval_and_expires_at", [
    "environment",
    "targetId",
    "commitSha",
    "approvalHash",
    "expiresAt",
  ])
  .index("by_verdict_hash", ["verdictHash"]);
