import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    snapshotId: Schema.String,
    environment: Schema.Literal("staging", "production"),
    targetId: Schema.String,
    commitSha: Schema.String,
    capturedAt: Schema.Number,
    expiresAt: Schema.Number,
    pageCount: Schema.Number,
    totalCount: Schema.Number,
    nextCursor: Schema.NullOr(Schema.String),
    runsJson: Schema.String,
    immutableBindingsJson: Schema.String,
  }),
).index("by_snapshot", ["snapshotId"]);
