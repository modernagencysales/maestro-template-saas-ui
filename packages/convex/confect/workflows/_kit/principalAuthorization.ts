import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  requireWorkspaceActorAccess,
  type WorkspaceActorAccess,
} from "../../capabilities/_kit/workspaceAccess";
import type { Role } from "../../access/roles";
import { MemberNotInWorkspace } from "../../errors";
import {
  assertConsequentialWorkflowAuthority,
  type CurrentWorkflowAuthority,
  type DurableWorkflowPrincipal,
} from "./principal";

export type WorkflowRoleGrantPolicy = Readonly<Record<Role, readonly string[]>>;

export const WorkflowCurrentAuthorityReceipt = Schema.Struct({
  kind: Schema.Literal("workflow-current-authority"),
  version: Schema.Literal(1),
  workspaceId: Schema.NonEmptyString,
  actorId: Schema.NonEmptyString,
  authEpoch: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  capability: Schema.NonEmptyString,
  workflowId: Schema.NonEmptyString,
  workflowVersion: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(1)),
  ),
  requiredGrants: Schema.Array(Schema.NonEmptyString),
});

export type WorkflowCurrentAuthorityReceipt = Schema.Schema.Type<
  typeof WorkflowCurrentAuthorityReceipt
>;

export const defineWorkflowRoleGrantPolicy = (
  policy: WorkflowRoleGrantPolicy,
): WorkflowRoleGrantPolicy => {
  for (const grants of Object.values(policy)) {
    if (new Set(grants).size !== grants.length) {
      throw new Error("Current workflow role grants must be unique.");
    }
  }
  return policy;
};

export const projectCurrentWorkflowAuthority = (
  principal: Extract<DurableWorkflowPrincipal, { readonly kind: "user" }>,
  access: Omit<WorkspaceActorAccess, "userId" | "workspaceId"> & {
    readonly userId: string;
    readonly workspaceId: string;
  },
  policy: WorkflowRoleGrantPolicy,
): CurrentWorkflowAuthority => ({
  active: true,
  workspaceId: access.workspaceId,
  actorId: access.userId,
  role: access.role,
  grants: policy[access.role],
  authEpoch: access.authEpoch,
});

export const requireConsequentialWorkflowAuthority = (
  principal: DurableWorkflowPrincipal,
  requiredGrants: readonly string[],
  currentGrantPolicy: WorkflowRoleGrantPolicy,
) =>
  principal.kind === "system"
    ? Effect.fail(new MemberNotInWorkspace({ membershipId: "workflow-actor" }))
    : Effect.gen(function* () {
        const access = yield* requireWorkspaceActorAccess(
          principal.workspaceId as GenericId<"workspaces">,
          principal.actorId as GenericId<"users">,
          principal.role,
        ).pipe(
          Effect.mapError(
            () => new MemberNotInWorkspace({ membershipId: "workflow-actor" }),
          ),
        );
        yield* Effect.try({
          try: () =>
            assertConsequentialWorkflowAuthority(
              principal,
              projectCurrentWorkflowAuthority(
                principal,
                access,
                currentGrantPolicy,
              ),
              requiredGrants,
            ),
          catch: () =>
            new MemberNotInWorkspace({ membershipId: "workflow-actor" }),
        });
        return access;
      });
