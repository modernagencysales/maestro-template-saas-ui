import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";

import { DatabaseWriter } from "../_generated/services";
import type { AccessLifecycleEvent } from "./lifecycle";

export type AccessAuditEventInsert = {
  readonly workspaceId: string;
  readonly action: AccessLifecycleEvent["action"];
  readonly actorUserId?: string;
  readonly actorEmail?: string;
  readonly subjectKind: AccessLifecycleEvent["subjectKind"];
  readonly subjectId: string;
  readonly metadataJson: string;
  readonly createdAt: number;
};

type Writer = Context.Service.Shape<typeof DatabaseWriter>;

export const accessAuditEventInsert = (
  event: AccessLifecycleEvent,
  createdAt: number,
): AccessAuditEventInsert => ({
  workspaceId: event.workspaceId,
  action: event.action,
  ...("actorUserId" in event ? { actorUserId: event.actorUserId } : {}),
  ...("actorEmail" in event ? { actorEmail: event.actorEmail } : {}),
  subjectKind: event.subjectKind,
  subjectId: event.subjectId,
  metadataJson: JSON.stringify(event.metadata),
  createdAt,
});

export const recordAccessLifecycleEvents = (
  writer: Writer,
  events: readonly AccessLifecycleEvent[],
  createdAt: number,
): Effect.Effect<void, never> =>
  Effect.forEach(events, (event) =>
    writer
      .table("accessAuditEvents")
      .insert(accessAuditEventInsert(event, createdAt))
      .pipe(Effect.orDie),
  ).pipe(Effect.asVoid);
