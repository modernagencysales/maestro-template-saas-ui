import * as Schema from "effect/Schema";

import {
  DurableWorkflowPrincipal,
  type DurableWorkflowPrincipal as DurableWorkflowPrincipalType,
} from "./principal";
import {
  WorkflowPolicySnapshot,
  type WorkflowPolicySnapshot as WorkflowPolicySnapshotType,
} from "./policySnapshot";

export type ObservedWorkflowAuthority = {
  readonly principal: DurableWorkflowPrincipalType;
  readonly policySnapshot: WorkflowPolicySnapshotType;
};

export const ObservedWorkflowAuthority = Schema.Struct({
  principal: DurableWorkflowPrincipal,
  policySnapshot: WorkflowPolicySnapshot,
});

export const decodeObservedWorkflowAuthority = Schema.decodeUnknownExit(
  ObservedWorkflowAuthority,
  { errors: "all", onExcessProperty: "error" },
);
