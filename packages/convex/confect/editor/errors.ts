import { ConvexError } from "convex/values";
import * as Schema from "effect/Schema";

export type EditorSyncAccessDeniedReason =
  | "unsupported-target"
  | "document-readable"
  | "authentication"
  | "provisioned-user"
  | "active-user"
  | "workspace-membership"
  | "editor-access";

export class EditorSyncAccessDenied extends Schema.TaggedErrorClass<EditorSyncAccessDenied>()(
  "EditorSyncAccessDenied",
  {
    reason: Schema.Literals([
      "unsupported-target",
      "document-readable",
      "authentication",
      "provisioned-user",
      "active-user",
      "workspace-membership",
      "editor-access",
    ]),
    message: Schema.String,
  },
) {}

export const editorSyncAccessDenied = (
  reason: EditorSyncAccessDeniedReason,
  message: string,
): ConvexError<{
  readonly _tag: "EditorSyncAccessDenied";
  readonly reason: EditorSyncAccessDeniedReason;
  readonly message: string;
}> =>
  new ConvexError(
    Schema.encodeSync(EditorSyncAccessDenied)(
      new EditorSyncAccessDenied({ reason, message }),
    ),
  );
