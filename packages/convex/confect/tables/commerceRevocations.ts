import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    paymentId: Schema.String,
    eventId: Schema.String,
    status: Schema.Literals(["refunded", "disputed"]),
    createdAt: Schema.Number,
  }),
)
  .index("by_payment", ["paymentId"])
  .index("by_event", ["eventId"]);
