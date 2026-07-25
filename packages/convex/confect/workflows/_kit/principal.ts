import * as Schema from "effect/Schema";

const WorkflowPrincipalBase = {
  version: Schema.Literal(1),
  workspaceId: Schema.NonEmptyString,
  grants: Schema.Array(Schema.NonEmptyString),
  kickoffAt: Schema.Number,
} as const;

export const WorkflowUserPrincipal = Schema.Struct({
  ...WorkflowPrincipalBase,
  kind: Schema.Literal("user"),
  actorId: Schema.NonEmptyString,
  role: Schema.NonEmptyString,
  authEpoch: Schema.Number,
  provenance: Schema.NonEmptyString,
});

export type WorkflowUserPrincipal = Schema.Schema.Type<
  typeof WorkflowUserPrincipal
>;

export const WorkflowSystemPrincipal = Schema.Struct({
  ...WorkflowPrincipalBase,
  kind: Schema.Literal("system"),
  systemId: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
});

export type WorkflowSystemPrincipal = Schema.Schema.Type<
  typeof WorkflowSystemPrincipal
>;

export const WorkflowPrincipal = Schema.Union(
  WorkflowUserPrincipal,
  WorkflowSystemPrincipal,
);

export type WorkflowPrincipal = Schema.Schema.Type<typeof WorkflowPrincipal>;

export const RESERVED_WORKFLOW_IDENTITY_FIELDS = new Set([
  "actorId",
  "authEpoch",
  "grants",
  "principal",
  "role",
  "systemId",
  "workspaceId",
]);

export const hasReservedWorkflowIdentityField = (
  input: Readonly<Record<string, unknown>>,
): boolean =>
  Object.keys(input).some((field) =>
    RESERVED_WORKFLOW_IDENTITY_FIELDS.has(field),
  );
