import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    sessionId: Schema.String,
    questionId: Schema.String,
    value: Schema.String,
    savedAt: Schema.Number,
  }),
)
  .index("by_session", ["sessionId"])
  .index("by_session_question", ["sessionId", "questionId"]);
