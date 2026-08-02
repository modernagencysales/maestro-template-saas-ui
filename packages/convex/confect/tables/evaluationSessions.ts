import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    sessionId: Schema.String,
    accessTokenHash: Schema.String,
    status: Schema.Literals([
      "collecting",
      "ready-to-evaluate",
      "evaluating",
      "completed",
      "failed-recoverable",
    ]),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_session", ["sessionId"])
  .index("by_access_token_hash", ["accessTokenHash"]);
