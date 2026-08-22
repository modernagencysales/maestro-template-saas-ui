import * as Schema from "effect/Schema";
import {
  Forbidden,
  MemberNotInWorkspace,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../../errors";

export const WorkspaceReadErrors = Schema.Union([
  Unauthorized,
  Forbidden,
  MemberNotInWorkspace,
  WorkspaceNotFound,
]);

export const WorkspaceWriteErrors = Schema.Union([
  Unauthorized,
  Forbidden,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  ValidationFailed,
]);

export const workspaceErrorTags = [
  "Unauthorized",
  "Forbidden",
  "MemberNotInWorkspace",
  "WorkspaceNotFound",
  "ValidationFailed",
] as const;
