import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    snapshotId: Schema.String,
    environment: Schema.Literals(["staging", "production"]),
    targetId: Schema.String,
    commitSha: Schema.String,
    capturedAt: Schema.Number,
    expiresAt: Schema.Number,
    pageCount: Schema.Number,
    totalCount: Schema.Number,
    nextCursor: Schema.NullOr(Schema.String),
    runsJson: Schema.String,
    immutableBindingsJson: Schema.String,
    authorityOrigin: Schema.optional(Schema.String),
    provisionedAt: Schema.optional(Schema.Number),
    provisionedByHash: Schema.optional(Schema.String),
    provenanceHash: Schema.optional(Schema.String),
  }),
)
  .index("by_snapshot", ["snapshotId"])
  .index("by_scope_and_expires_at", [
    "environment",
    "targetId",
    "commitSha",
    "expiresAt",
  ]);
