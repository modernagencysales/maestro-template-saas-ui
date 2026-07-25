import { vi } from "vitest";

import {
  createWorkflowLifecycleControls,
  type WorkflowLifecycleAuditEvent,
  type WorkflowLifecycleControlPorts,
  type WorkflowLifecycleOwnedRun,
  type WorkflowLifecyclePrincipal,
} from "../confect/workflows/_kit/lifecycle";
import { createWorkflowLifecycleState } from "../confect/workflows/_kit/lifecycleState";

export const principal: WorkflowLifecyclePrincipal = {
  workspaceId: "workspace-a",
  actorId: "user-a",
  authority: "operator",
};

const activeRun = (): WorkflowLifecycleOwnedRun => ({
  workflowRunId: "run-a",
  componentWorkflowId: "component-a",
  workflowName: "invoice-review",
  state: createWorkflowLifecycleState({
    workspaceId: "workspace-a",
    workflowRunId: "run-a",
    workflowId: "workflow.invoice",
    workflowVersion: 3,
  }),
});

export const terminalRun = (
  overrides: Partial<WorkflowLifecycleOwnedRun["state"]> = {},
): WorkflowLifecycleOwnedRun => ({
  ...activeRun(),
  state: createWorkflowLifecycleState({
    workspaceId: "workspace-a",
    workflowRunId: "run-a",
    workflowId: "workflow.invoice",
    workflowVersion: 3,
    execution: "terminal",
    priorGenerationQuiescence: "quiescent",
    retention: {
      parentUntil: 100,
      childUntil: 125,
      evidenceUntil: 150,
    },
    ...overrides,
  }),
});

export const lifecycleHarness = (run = activeRun()) => {
  let storedRun = run;
  const audits: WorkflowLifecycleAuditEvent[] = [];
  const ports: WorkflowLifecycleControlPorts = {
    authorize: vi.fn(async () => true),
    loadOwnedRun: vi.fn(async (workspaceId, workflowRunId) =>
      workspaceId === storedRun.state.workspaceId &&
      workflowRunId === storedRun.workflowRunId
        ? storedRun
        : null,
    ),
    saveLifecycleState: vi.fn(async (_workflowRunId, state) => {
      storedRun = { ...storedRun, state };
    }),
    appendAudit: vi.fn(async (event) => {
      audits.push(event);
    }),
    listOwnedRuns: vi.fn(async () => ({
      page: [
        {
          workflowRunId: "run-a",
          workflowName: "invoice-review",
          workflowId: "workflow.invoice",
          workflowVersion: 3,
          status: "running",
          generation: 0,
          startedAt: 10,
          completedAt: null,
          rawArgs: { secret: "must-not-project" },
        },
      ],
      isDone: true,
      continueCursor: "",
    })),
    listOwnedRunsByName: vi.fn(async () => ({
      page: [
        {
          workflowRunId: "run-a",
          workflowName: "invoice-review",
          workflowId: "workflow.invoice",
          workflowVersion: 3,
          status: "running",
          generation: 0,
          startedAt: 10,
          completedAt: null,
          componentWorkflowId: "must-not-project",
        },
      ],
      isDone: true,
      continueCursor: "",
    })),
    listOwnedSteps: vi.fn(async () => ({
      page: [
        {
          stepName: "review.v3",
          status: "succeeded",
          attempt: 1,
          startedAt: 11,
          finishedAt: 12,
          errorCode: null,
          args: { secret: true },
          result: { secret: true },
        },
      ],
      isDone: true,
      continueCursor: "",
    })),
    inspectRestart: vi.fn(async () => ({
      discardedSteps: ["review.v3"],
      externalEffects: [],
    })),
    inspectQuiescence: vi.fn(async () => ({
      inProgressSteps: [],
      inProgressChildren: [],
    })),
    inspectRetention: vi.fn(async () => ({
      ...storedRun.state.retention,
      activeChildCount: 0,
      retentionUnverifiable: false,
    })),
    component: {
      status: vi.fn(async () => ({ type: "completed" as const })),
      cancel: vi.fn(async () => undefined),
      restart: vi.fn(async () => undefined),
      cleanup: vi.fn(async () => true),
    },
  };
  return {
    audits,
    controls: createWorkflowLifecycleControls(ports),
    currentRun: () => storedRun,
    ports,
  };
};
