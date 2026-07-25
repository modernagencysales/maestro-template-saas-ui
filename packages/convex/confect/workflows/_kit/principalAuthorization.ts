import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";

import { requireWorkspaceActorAccess } from "../../capabilities/_kit/workspaceAccess";
import { MemberNotInWorkspace } from "../../errors";
import {
  assertConsequentialWorkflowAuthority,
  type DurableWorkflowPrincipal,
} from "./principal";

export const requireConsequentialWorkflowAuthority = (
  principal: DurableWorkflowPrincipal,
  requiredGrants: readonly string[],
) =>
  principal.kind === "system"
    ? Effect.fail(new MemberNotInWorkspace({ membershipId: "workflow-actor" }))
    : Effect.gen(function* () {
        const access = yield* requireWorkspaceActorAccess(
          principal.workspaceId as GenericId<"workspaces">,
          principal.actorId as GenericId<"users">,
          principal.role,
        );
        yield* Effect.try({
          try: () =>
            assertConsequentialWorkflowAuthority(
              principal,
              {
                active: true,
                workspaceId: access.workspaceId,
                actorId: access.userId,
                role: access.role,
                grants: principal.grants,
                authEpoch: access.authEpoch,
              },
              requiredGrants,
            ),
          catch: () =>
            new MemberNotInWorkspace({ membershipId: "workflow-actor" }),
        });
        return access;
      });
