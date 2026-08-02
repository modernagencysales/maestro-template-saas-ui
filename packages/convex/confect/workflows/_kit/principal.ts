import * as Schema from "effect/Schema";
import { v } from "convex/values";
import { roleAtLeast, Role, type Role as RoleType } from "../../access/roles";

const WorkflowPrincipalV1Base = {
  version: Schema.Literal(1),
  workspaceId: Schema.NonEmptyString,
  grants: Schema.Array(Schema.NonEmptyString),
  kickoffAt: Schema.Number,
} as const;

export const WorkflowUserPrincipal = Schema.Struct({
  ...WorkflowPrincipalV1Base,
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
  ...WorkflowPrincipalV1Base,
  kind: Schema.Literal("system"),
  systemId: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
});

export type WorkflowSystemPrincipal = Schema.Schema.Type<
  typeof WorkflowSystemPrincipal
>;

export const LegacyWorkflowPrincipal = Schema.Union([
  WorkflowUserPrincipal,
  WorkflowSystemPrincipal,
]);

const PrincipalGrant = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isMaxLength(128)),
);
const WorkflowPrincipalV2Base = {
  version: Schema.Literal(2),
  workspaceId: Schema.NonEmptyString,
  grants: Schema.Array(PrincipalGrant),
  kickoffAt: Schema.Number.pipe(
    Schema.check(Schema.isFinite()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
} as const;

export const WorkflowUserPrincipalV2 = Schema.Struct({
  ...WorkflowPrincipalV2Base,
  kind: Schema.Literal("user"),
  actorId: Schema.NonEmptyString,
  role: Role,
  authEpoch: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  provenance: Schema.Literal("authenticated-workflow-start"),
});

export const WorkflowSystemPrincipalV2 = Schema.Struct({
  ...WorkflowPrincipalV2Base,
  kind: Schema.Literal("system"),
  systemId: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
  provenance: Schema.Literal("scheduled-system-workflow"),
});

export const DurableWorkflowPrincipal = Schema.Union([
  WorkflowUserPrincipalV2,
  WorkflowSystemPrincipalV2,
]);
export type DurableWorkflowPrincipal = Schema.Schema.Type<
  typeof DurableWorkflowPrincipal
>;

export const DurableWorkflowPrincipalValidator = v.union(
  v.object({
    version: v.literal(2),
    kind: v.literal("user"),
    workspaceId: v.string(),
    actorId: v.string(),
    role: v.union(
      v.literal("viewer"),
      v.literal("editor"),
      v.literal("admin"),
      v.literal("owner"),
    ),
    grants: v.array(v.string()),
    authEpoch: v.number(),
    kickoffAt: v.number(),
    provenance: v.literal("authenticated-workflow-start"),
  }),
  v.object({
    version: v.literal(2),
    kind: v.literal("system"),
    workspaceId: v.string(),
    systemId: v.string(),
    reason: v.string(),
    grants: v.array(v.string()),
    kickoffAt: v.number(),
    provenance: v.literal("scheduled-system-workflow"),
  }),
);

export const WorkflowPrincipal = Schema.Union([
  LegacyWorkflowPrincipal,
  DurableWorkflowPrincipal,
]);
export type WorkflowPrincipal = Schema.Schema.Type<typeof WorkflowPrincipal>;

export const createWorkflowUserPrincipal = (input: {
  readonly workspaceId: string;
  readonly actorId: string;
  readonly role: "viewer" | "editor" | "admin" | "owner";
  readonly grants: readonly string[];
  readonly authEpoch: number;
  readonly kickoffAt: number;
}): DurableWorkflowPrincipal =>
  decodeDurablePrincipal({
    version: 2,
    kind: "user",
    ...input,
    grants: uniqueGrants(input.grants),
    provenance: "authenticated-workflow-start",
  });

export const createWorkflowSystemPrincipal = (input: {
  readonly workspaceId: string;
  readonly systemId: string;
  readonly reason: string;
  readonly grants: readonly string[];
  readonly kickoffAt: number;
}): DurableWorkflowPrincipal => {
  if (input.grants.some((grant) => grant.startsWith("user:"))) {
    throw new Error("System workflow principals cannot acquire user grants.");
  }
  return decodeDurablePrincipal({
    version: 2,
    kind: "system",
    ...input,
    grants: uniqueGrants(input.grants),
    provenance: "scheduled-system-workflow",
  });
};

export const assertWorkflowPrincipalAuthority = (
  principal: DurableWorkflowPrincipal,
  input: {
    readonly workspaceId: string;
    readonly requiredGrants: readonly string[];
  },
): void => {
  if (principal.workspaceId !== input.workspaceId) {
    throw new Error("Workflow principal is unavailable.");
  }
  const grants = new Set(principal.grants);
  if (input.requiredGrants.some((grant) => !grants.has(grant))) {
    throw new Error("Workflow principal is unavailable.");
  }
};

export const adaptLegacyActiveWorkflowPrincipal = (input: {
  readonly workspaceId: string;
  readonly startedByUserId: string;
  readonly startedAt: number;
}) => ({
  kind: "legacy-active" as const,
  workspaceId: input.workspaceId,
  actorId: input.startedByUserId,
  kickoffAt: input.startedAt,
  consequentialEffects: "reauthorization-required" as const,
});

export const resolveWorkflowRunPrincipal = (row: {
  readonly workspaceId: string;
  readonly startedByUserId: string;
  readonly startedAt: number;
  readonly principalSnapshot?: DurableWorkflowPrincipal | null | undefined;
}):
  | DurableWorkflowPrincipal
  | ReturnType<typeof adaptLegacyActiveWorkflowPrincipal> => {
  if (row.principalSnapshot) {
    const principal = decodeDurablePrincipal(row.principalSnapshot);
    assertWorkflowPrincipalAuthority(principal, {
      workspaceId: row.workspaceId,
      requiredGrants: [],
    });
    return principal;
  }
  return adaptLegacyActiveWorkflowPrincipal(row);
};

export type CurrentWorkflowAuthority = {
  readonly active: boolean;
  readonly workspaceId: string;
  readonly actorId: string;
  readonly role: RoleType;
  readonly grants: readonly string[];
  readonly authEpoch: number;
};

export const assertConsequentialWorkflowAuthority = (
  principal: DurableWorkflowPrincipal,
  current: CurrentWorkflowAuthority,
  requiredGrants: readonly string[],
): void => {
  const currentGrants = new Set(current.grants);
  const unavailable =
    !current.active ||
    current.workspaceId !== principal.workspaceId ||
    principal.kind !== "user" ||
    current.actorId !== principal.actorId ||
    !roleAtLeast(current.role, principal.role) ||
    current.authEpoch < principal.authEpoch ||
    requiredGrants.some(
      (grant) => !principal.grants.includes(grant) || !currentGrants.has(grant),
    );
  if (unavailable) throw new Error("Workflow authority is unavailable.");
};

const decodeDurablePrincipal = (input: unknown): DurableWorkflowPrincipal =>
  Schema.decodeUnknownSync(DurableWorkflowPrincipal)(input);

const uniqueGrants = (grants: readonly string[]): readonly string[] => {
  const unique = [...new Set(grants)].sort();
  if (unique.length !== grants.length) {
    throw new Error("Workflow principal grants must be unique.");
  }
  return unique;
};

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
