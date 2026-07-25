import * as Schema from "effect/Schema";

import {
  audit,
  componentCall,
  controlError,
  guard,
  ownedRun,
  transition,
  validControlInput,
  type ControlInput,
  type WorkflowLifecycleControlPorts,
  type WorkflowLifecyclePrincipal,
  type WorkflowRestartInspection,
} from "./lifecycleControls";
import { WorkflowStepName } from "./workflowReferences";

export const restartWorkflowLifecycle = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  input: ControlInput & { readonly restartAnchor: string },
) => {
  const run = await ownedRun(ports, principal, "restart", input.workflowRunId);
  validControlInput(input);
  const restartAnchor = decodeRestartAnchor(input.restartAnchor);
  const status = await componentCall(() =>
    ports.component.status(run.componentWorkflowId),
  );
  const exposedWork = await ports.inspectQuiescence({
    workspaceId: principal.workspaceId,
    workflowRunId: run.workflowRunId,
    componentWorkflowId: run.componentWorkflowId,
  });
  if (
    status.type === "inProgress" ||
    exposedWork.inProgressSteps.length > 0 ||
    exposedWork.inProgressChildren.length > 0
  ) {
    throw controlError(
      "INVALID_STATE",
      "Workflow restart requires component-proven prior-generation quiescence.",
    );
  }
  const quiescent =
    run.state.priorGenerationQuiescence === "quiescent"
      ? run.state
      : transition(run.state, {
          kind: "mark-generation-quiescent",
          ...guard(run),
        });
  const next = transition(quiescent, {
    kind: "advance-generation",
    ...guard(run),
    nextGeneration: run.state.generation + 1,
    restartAnchor,
  });
  const inspection = await ports.inspectRestart({
    workspaceId: principal.workspaceId,
    workflowRunId: run.workflowRunId,
    generation: run.state.generation,
    restartAnchor,
  });
  const discardedSteps = inspection.discardedSteps.map(decodeStepName);
  for (const effect of inspection.externalEffects)
    decodeStepName(effect.stepName);
  if (
    inspection.externalEffects.some(
      (effect) => !restartSafe(effect, input.occurredAt),
    )
  ) {
    throw controlError(
      "RESTART_UNSAFE",
      "Workflow restart contains an external effect without a sufficient restart-safe dedupe horizon.",
    );
  }
  await componentCall(() =>
    ports.component.restart(run.componentWorkflowId, {
      from: restartAnchor === "beginning" ? 0 : restartAnchor,
      startAsync: true,
    }),
  );
  await ports.saveLifecycleState(run.workflowRunId, next);
  await ports.appendAudit(
    audit(principal, run, next, input, "restart", discardedSteps.length),
  );
  return { generation: next.generation, discardedSteps };
};

export const cleanupWorkflowLifecycle = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  input: ControlInput,
) => {
  const run = await ownedRun(ports, principal, "cleanup", input.workflowRunId);
  validControlInput(input);
  const status = await componentCall(() =>
    ports.component.status(run.componentWorkflowId),
  );
  const exposedWork = await ports.inspectQuiescence({
    workspaceId: principal.workspaceId,
    workflowRunId: run.workflowRunId,
    componentWorkflowId: run.componentWorkflowId,
  });
  if (
    status.type === "inProgress" ||
    exposedWork.inProgressSteps.length > 0 ||
    exposedWork.inProgressChildren.length > 0
  ) {
    throw controlError(
      "INVALID_STATE",
      "Workflow cleanup requires component and exposed-work quiescence.",
    );
  }
  const retention = await ports.inspectRetention({
    workspaceId: principal.workspaceId,
    workflowRunId: run.workflowRunId,
    componentWorkflowId: run.componentWorkflowId,
  });
  if (retention.activeChildCount > 0 || retention.retentionUnverifiable) {
    throw controlError(
      "INVALID_STATE",
      "Workflow cleanup requires verifiable retained child and evidence state.",
    );
  }
  const quiescent =
    run.state.priorGenerationQuiescence === "quiescent"
      ? run.state
      : transition(run.state, {
          kind: "mark-generation-quiescent",
          ...guard(run),
        });
  const retainedState = {
    ...quiescent,
    retention: {
      parentUntil: retention.parentUntil,
      childUntil: retention.childUntil,
      evidenceUntil: retention.evidenceUntil,
    },
  };
  let next = transition(retainedState, {
    kind: "request-cleanup",
    ...guard(run),
    now: input.occurredAt,
  });
  next = transition(next, { kind: "begin-product-cleanup", ...guard(run) });
  next = transition(next, {
    kind: "request-component-cleanup",
    ...guard(run),
  });
  const accepted = await componentCall(() =>
    ports.component.cleanup(run.componentWorkflowId),
  );
  if (!accepted) {
    throw controlError(
      "COMPONENT_REJECTED",
      "Workflow component did not accept the cleanup request.",
    );
  }
  await ports.saveLifecycleState(run.workflowRunId, next);
  await ports.appendAudit(audit(principal, run, next, input, "cleanup", 0));
  return {
    status: "component-cleanup-requested" as const,
    fullDeletionProven: false as const,
  };
};

export const reconcileWorkflowCleanup = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  input: ControlInput,
) => {
  const run = await ownedRun(ports, principal, "cleanup", input.workflowRunId);
  validControlInput(input);
  if (run.state.cleanup === "product-cleaned") {
    return cleanedProjection();
  }
  if (
    run.state.componentCleanup !== "component-cleanup-requested" &&
    run.state.componentCleanup !== "component-known-work-complete"
  ) {
    throw controlError(
      "INVALID_STATE",
      "Cleanup reconciliation requires a component cleanup request.",
    );
  }
  let next = run.state;
  if (next.componentCleanup === "component-cleanup-requested") {
    const exposedWork = await ports.inspectQuiescence({
      workspaceId: principal.workspaceId,
      workflowRunId: run.workflowRunId,
      componentWorkflowId: run.componentWorkflowId,
    });
    if (
      exposedWork.inProgressSteps.length > 0 ||
      exposedWork.inProgressChildren.length > 0
    ) {
      return {
        status: "component-cleanup-requested" as const,
        componentCleanup: "component-cleanup-requested" as const,
        componentResiduals: next.componentResiduals,
        fullDeletionProven: false as const,
      };
    }
    next = transition(next, {
      kind: "mark-component-known-work-complete",
      ...guard(run),
    });
  }
  if (next.componentResiduals !== "component-residuals-unverifiable") {
    next = transition(next, {
      kind: "mark-component-residuals-unverifiable",
      ...guard(run),
    });
  }
  next = transition(next, { kind: "mark-product-cleaned", ...guard(run) });
  await ports.saveLifecycleState(run.workflowRunId, next);
  return cleanedProjection();
};

const cleanedProjection = () => ({
  status: "product-cleaned" as const,
  componentCleanup: "component-known-work-complete" as const,
  componentResiduals: "component-residuals-unverifiable" as const,
  fullDeletionProven: false as const,
});

const restartSafe = (
  effect: WorkflowRestartInspection["externalEffects"][number],
  occurredAt: number,
) =>
  effect.restartSafe &&
  Number.isFinite(effect.restartSafeUntil) &&
  Number.isFinite(effect.dedupeExpiresAt) &&
  effect.restartSafeUntil >= occurredAt &&
  effect.dedupeExpiresAt >= effect.restartSafeUntil;

const decodeRestartAnchor = (input: string) => {
  if (input === "beginning") return input;
  try {
    return Schema.decodeSync(WorkflowStepName)(input);
  } catch {
    throw controlError(
      "VALIDATION_FAILED",
      "Restart anchor must be beginning or a stable versioned step name.",
    );
  }
};

const decodeStepName = (input: string) => {
  try {
    return Schema.decodeSync(WorkflowStepName)(input);
  } catch {
    throw controlError(
      "VALIDATION_FAILED",
      "Lifecycle preflight returned an unstable step name.",
    );
  }
};
