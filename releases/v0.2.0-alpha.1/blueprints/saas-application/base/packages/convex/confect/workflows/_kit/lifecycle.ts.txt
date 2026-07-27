import {
  cancelWorkflowLifecycle,
  type ControlInput,
  type PaginationInput,
  type WorkflowLifecycleControlPorts,
  type WorkflowLifecyclePrincipal,
} from "./lifecycleControls";
import {
  listWorkflowLifecycles,
  listWorkflowLifecyclesByName,
  listWorkflowLifecycleSteps,
} from "./lifecycleProjections";
import {
  cleanupWorkflowLifecycle,
  reconcileWorkflowCleanup,
  restartWorkflowLifecycle,
} from "./lifecycleSafety";

export { WorkflowLifecycleControlError } from "./lifecycleControls";
export type {
  WorkflowLifecycleAuditEvent,
  WorkflowLifecycleControlPorts,
  WorkflowLifecycleOperation,
  WorkflowLifecycleOwnedRun,
  WorkflowLifecyclePrincipal,
  WorkflowLifecycleReasonCode,
  WorkflowRestartInspection,
  WorkflowRunProjectionSource,
  WorkflowStepProjectionSource,
} from "./lifecycleControls";

export const createWorkflowLifecycleControls = (
  ports: WorkflowLifecycleControlPorts,
) => ({
  cancel: (principal: WorkflowLifecyclePrincipal, input: ControlInput) =>
    cancelWorkflowLifecycle(ports, principal, input),
  restart: (
    principal: WorkflowLifecyclePrincipal,
    input: ControlInput & { readonly restartAnchor: string },
  ) => restartWorkflowLifecycle(ports, principal, input),
  list: (principal: WorkflowLifecyclePrincipal, pagination: PaginationInput) =>
    listWorkflowLifecycles(ports, principal, pagination),
  listByName: (
    principal: WorkflowLifecyclePrincipal,
    input: PaginationInput & { readonly workflowName: string },
  ) => listWorkflowLifecyclesByName(ports, principal, input),
  listSteps: (
    principal: WorkflowLifecyclePrincipal,
    input: PaginationInput & { readonly workflowRunId: string },
  ) => listWorkflowLifecycleSteps(ports, principal, input),
  cleanup: (principal: WorkflowLifecyclePrincipal, input: ControlInput) =>
    cleanupWorkflowLifecycle(ports, principal, input),
  reconcileCleanup: (
    principal: WorkflowLifecyclePrincipal,
    input: ControlInput,
  ) => reconcileWorkflowCleanup(ports, principal, input),
});
