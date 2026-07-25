import { describe, expect, it, vi } from "vitest";

import {
  createWorkflowLifecycleControls,
  WorkflowLifecycleControlError,
  type WorkflowLifecycleAuditEvent,
  type WorkflowLifecycleControlPorts,
  type WorkflowLifecycleOwnedRun,
  type WorkflowLifecyclePrincipal,
} from "../confect/workflows/_kit/lifecycle";
import { createWorkflowLifecycleState } from "../confect/workflows/_kit/lifecycleState";

const principal: WorkflowLifecyclePrincipal = {
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

const terminalRun = (
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

const harness = (run = activeRun()) => {
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
    component: {
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

describe("tenant-safe workflow lifecycle controls", () => {
  it("reauthorizes and cancels an owned run with a redacted audit", async () => {
    const fixture = harness();
    const result = await fixture.controls.cancel(principal, {
      workflowRunId: "run-a",
      reasonCode: "operator-request",
      occurredAt: 200,
    });
    expect(fixture.ports.authorize).toHaveBeenCalledWith(principal, "cancel");
    expect(fixture.ports.component.cancel).toHaveBeenCalledWith("component-a");
    expect(result).toEqual({ status: "canceled", actionMayFinish: true });
    expect(fixture.currentRun().state).toMatchObject({
      execution: "canceled",
      priorGenerationQuiescence: "pending",
    });
    expect(fixture.audits).toEqual([
      expect.objectContaining({
        type: "workflow.cancel.requested",
        workflowRunId: "run-a",
        generation: 0,
        reasonCode: "operator-request",
        redacted: true,
      }),
    ]);
    expect(JSON.stringify(fixture.audits)).not.toContain("component-a");
  });

  it("fails opaquely before component access for another tenant", async () => {
    const fixture = harness();
    await expect(
      fixture.controls.cancel(
        { ...principal, workspaceId: "workspace-b" },
        {
          workflowRunId: "run-a",
          reasonCode: "operator-request",
          occurredAt: 200,
        },
      ),
    ).rejects.toMatchObject({
      _tag: "WorkflowLifecycleControlError",
      code: "UNAVAILABLE",
      message: "Workflow lifecycle resource is unavailable.",
    });
    expect(fixture.ports.component.cancel).not.toHaveBeenCalled();
  });

  it.each([
    [
      "list",
      (controls: ReturnType<typeof createWorkflowLifecycleControls>) =>
        controls.list(principal, { cursor: null, limit: 10 }),
    ],
    [
      "listByName",
      (controls: ReturnType<typeof createWorkflowLifecycleControls>) =>
        controls.listByName(principal, {
          workflowName: "invoice-review",
          cursor: null,
          limit: 10,
        }),
    ],
    [
      "listSteps",
      (controls: ReturnType<typeof createWorkflowLifecycleControls>) =>
        controls.listSteps(principal, {
          workflowRunId: "run-a",
          cursor: null,
          limit: 10,
        }),
    ],
  ] as const)(
    "reauthorizes and redacts %s projections",
    async (operation, invoke) => {
      const fixture = harness();
      const result = await invoke(fixture.controls);
      expect(fixture.ports.authorize).toHaveBeenCalledWith(
        principal,
        operation,
      );
      expect(JSON.stringify(result)).not.toMatch(
        /secret|rawArgs|componentWorkflowId|args|result/,
      );
    },
  );

  it("refuses restart until the prior generation is quiescent", async () => {
    const fixture = harness(
      terminalRun({ priorGenerationQuiescence: "pending" }),
    );
    await expect(
      fixture.controls.restart(principal, {
        workflowRunId: "run-a",
        restartAnchor: "review.v3",
        reasonCode: "recovery",
        occurredAt: 200,
      }),
    ).rejects.toBeInstanceOf(WorkflowLifecycleControlError);
    expect(fixture.ports.inspectRestart).not.toHaveBeenCalled();
    expect(fixture.ports.component.restart).not.toHaveBeenCalled();
  });

  it("refuses an undeclared or expired external effect before restart", async () => {
    const fixture = harness(terminalRun());
    vi.mocked(fixture.ports.inspectRestart).mockResolvedValue({
      discardedSteps: ["charge.v3"],
      externalEffects: [
        {
          stepName: "charge.v3",
          restartSafe: false,
          restartSafeUntil: 500,
          dedupeExpiresAt: 500,
        },
      ],
    });
    await expect(
      fixture.controls.restart(principal, {
        workflowRunId: "run-a",
        restartAnchor: "charge.v3",
        reasonCode: "recovery",
        occurredAt: 200,
      }),
    ).rejects.toMatchObject({ code: "RESTART_UNSAFE" });
    expect(fixture.ports.component.restart).not.toHaveBeenCalled();
    expect(fixture.audits).toEqual([]);
  });

  it("restarts from a stable name with exact queued component options", async () => {
    const fixture = harness(terminalRun());
    const result = await fixture.controls.restart(principal, {
      workflowRunId: "run-a",
      restartAnchor: "review.v3",
      reasonCode: "recovery",
      occurredAt: 200,
    });
    expect(fixture.ports.component.restart).toHaveBeenCalledWith(
      "component-a",
      { from: "review.v3", startAsync: true },
    );
    expect(result).toEqual({
      generation: 1,
      discardedSteps: ["review.v3"],
    });
    expect(fixture.currentRun().state).toMatchObject({
      execution: "active",
      generation: 1,
      restartAnchor: "review.v3",
    });
    expect(fixture.audits[0]).toMatchObject({
      type: "workflow.restart.requested",
      reasonCode: "recovery",
      generation: 1,
      redacted: true,
    });
  });

  it("refuses retained cleanup and never equates acceptance with completion", async () => {
    const fixture = harness(terminalRun());
    await expect(
      fixture.controls.cleanup(principal, {
        workflowRunId: "run-a",
        reasonCode: "retention-sweep",
        occurredAt: 149,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(fixture.ports.component.cleanup).not.toHaveBeenCalled();

    const accepted = await fixture.controls.cleanup(principal, {
      workflowRunId: "run-a",
      reasonCode: "retention-sweep",
      occurredAt: 150,
    });
    expect(accepted).toEqual({
      status: "component-cleanup-requested",
      fullDeletionProven: false,
    });
    expect(fixture.currentRun().state).toMatchObject({
      cleanup: "in-progress",
      componentCleanup: "component-cleanup-requested",
    });
    expect(fixture.audits.at(-1)).toMatchObject({
      type: "workflow.cleanup.requested",
      redacted: true,
    });
  });

  it("rejects invalid pagination before product queries", async () => {
    const fixture = harness();
    await expect(
      fixture.controls.list(principal, { cursor: null, limit: 101 }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(fixture.ports.listOwnedRuns).not.toHaveBeenCalled();
  });
});
