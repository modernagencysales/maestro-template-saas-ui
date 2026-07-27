import {
  authorized,
  controlError,
  ownedRun,
  type Page,
  type PaginationInput,
  type WorkflowLifecycleControlPorts,
  type WorkflowLifecyclePrincipal,
  type WorkflowRunProjectionSource,
  type WorkflowStepProjectionSource,
} from "./lifecycleControls";

export const listWorkflowLifecycles = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  pagination: PaginationInput,
) => {
  await authorized(ports, principal, "list");
  const page = await ports.listOwnedRuns(
    principal.workspaceId,
    validPagination(pagination),
  );
  return mapPage(page, pagination.limit, projectRun);
};

export const listWorkflowLifecyclesByName = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  input: PaginationInput & { readonly workflowName: string },
) => {
  await authorized(ports, principal, "listByName");
  if (!input.workflowName || input.workflowName.length > 128) {
    throw controlError("VALIDATION_FAILED", "Workflow name is invalid.");
  }
  const page = await ports.listOwnedRunsByName(
    principal.workspaceId,
    input.workflowName,
    validPagination(input),
  );
  return mapPage(page, input.limit, projectRun);
};

export const listWorkflowLifecycleSteps = async (
  ports: WorkflowLifecycleControlPorts,
  principal: WorkflowLifecyclePrincipal,
  input: PaginationInput & { readonly workflowRunId: string },
) => {
  const run = await ownedRun(
    ports,
    principal,
    "listSteps",
    input.workflowRunId,
  );
  const page = await ports.listOwnedSteps(
    principal.workspaceId,
    run.workflowRunId,
    run.state.generation,
    validPagination(input),
  );
  return mapPage(page, input.limit, projectStep);
};

const validPagination = (input: PaginationInput): PaginationInput => {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw controlError(
      "VALIDATION_FAILED",
      "Pagination limit must be 1 through 100.",
    );
  }
  return { cursor: input.cursor, limit: input.limit };
};

const mapPage = <Input, Output>(
  page: Page<Input>,
  limit: number,
  map: (row: Input) => Output,
) => {
  if (page.page.length > limit) {
    throw controlError(
      "VALIDATION_FAILED",
      "Lifecycle page exceeds its requested bound.",
    );
  }
  return {
    page: page.page.map(map),
    isDone: page.isDone,
    continueCursor: page.continueCursor,
  };
};

const projectRun = (row: WorkflowRunProjectionSource) => ({
  workflowRunId: row.workflowRunId,
  workflowName: row.workflowName,
  workflowId: row.workflowId,
  workflowVersion: row.workflowVersion,
  status: row.status,
  generation: row.generation,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
});

const projectStep = (row: WorkflowStepProjectionSource) => ({
  stepName: row.stepName,
  status: row.status,
  attempt: row.attempt,
  startedAt: row.startedAt,
  finishedAt: row.finishedAt,
  errorCode: row.errorCode,
});
