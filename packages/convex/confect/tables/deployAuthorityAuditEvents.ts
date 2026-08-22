import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    eventId: Schema.String,
    operation: Schema.Literals([
      "issuer-provisioned",
      "issuer-rotated",
      "issuer-retired",
      "approval-provisioned",
      "census-provisioned",
      "verdict-provisioned",
    ]),
    actorHash: Schema.String,
    authorityOrigin: Schema.String,
    subjectKind: Schema.Literals(["issuer", "approval", "census", "verdict"]),
    subjectId: Schema.String,
    subjectFingerprint: Schema.String,
    provenanceHash: Schema.String,
    occurredAt: Schema.Number,
  }),
)
  .index("by_event", ["eventId"])
  .index("by_occurred_at", ["occurredAt"])
  .index("by_occurred_at_and_event_id", ["occurredAt", "eventId"])
  .index("by_subject", ["subjectKind", "subjectId"])
  .index("by_actor_and_occurred_at", ["actorHash", "occurredAt"]);
