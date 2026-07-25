import { describe, expect, it, vi } from "vitest";

import { WorkflowLifecycleControlError } from "../confect/workflows/_kit/lifecycle";
import {
  lifecycleHarness,
  principal,
  terminalRun,
} from "./workflow-lifecycle-controls.fixture";

describe("tenant-safe workflow lifecycle safety", () => {
  it("refuses restart until the prior generation is quiescent", async () => {
    const fixture = lifecycleHarness(
      terminalRun({ priorGenerationQuiescence: "pending" }),
    );
    vi.mocked(fixture.ports.component.status).mockResolvedValue({
      type: "canceled",
    });
    vi.mocked(fixture.ports.inspectQuiescence).mockResolvedValue({
      inProgressSteps: ["action.v3"],
      inProgressChildren: [],
    });
    await expect(
      fixture.controls.restart(principal, {
        workflowRunId: "run-a",
        restartAnchor: "review.v3",
        reasonCode: "recovery",
        occurredAt: 200,
      }),
    ).rejects.toBeInstanceOf(WorkflowLifecycleControlError);
    expect(fixture.ports.inspectQuiescence).toHaveBeenCalledWith({
      workspaceId: "workspace-a",
      workflowRunId: "run-a",
      componentWorkflowId: "component-a",
    });
    expect(fixture.ports.inspectRestart).not.toHaveBeenCalled();
    expect(fixture.ports.component.restart).not.toHaveBeenCalled();
  });

  it("records component-proven quiescence before advancing a generation", async () => {
    const fixture = lifecycleHarness(
      terminalRun({ priorGenerationQuiescence: "pending" }),
    );

    await expect(
      fixture.controls.restart(principal, {
        workflowRunId: "run-a",
        restartAnchor: "review.v3",
        reasonCode: "recovery",
        occurredAt: 200,
      }),
    ).resolves.toMatchObject({ generation: 1 });
    expect(fixture.ports.component.status).toHaveBeenCalledWith("component-a");
    expect(fixture.currentRun().state).toMatchObject({
      generation: 1,
      priorGenerationQuiescence: "quiescent",
    });
  });

  it("refuses an undeclared or expired external effect before restart", async () => {
    const fixture = lifecycleHarness(terminalRun());
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
    const fixture = lifecycleHarness(terminalRun());
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
    expect(result).toEqual({ generation: 1, discardedSteps: ["review.v3"] });
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
    const fixture = lifecycleHarness(terminalRun());
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

  it("reconciles exposed cleanup work without claiming hidden deletion", async () => {
    const fixture = lifecycleHarness(
      terminalRun({
        cleanup: "in-progress",
        componentCleanup: "component-cleanup-requested",
      }),
    );
    vi.mocked(fixture.ports.inspectQuiescence).mockResolvedValueOnce({
      inProgressSteps: ["action.v3"],
      inProgressChildren: [],
    });
    await expect(
      fixture.controls.reconcileCleanup(principal, {
        workflowRunId: "run-a",
        reasonCode: "retention-sweep",
        occurredAt: 200,
      }),
    ).resolves.toEqual({
      status: "component-cleanup-requested",
      componentCleanup: "component-cleanup-requested",
      componentResiduals: "not-assessed",
      fullDeletionProven: false,
    });

    vi.mocked(fixture.ports.inspectQuiescence).mockResolvedValueOnce({
      inProgressSteps: [],
      inProgressChildren: [],
    });
    await expect(
      fixture.controls.reconcileCleanup(principal, {
        workflowRunId: "run-a",
        reasonCode: "retention-sweep",
        occurredAt: 201,
      }),
    ).resolves.toEqual({
      status: "product-cleaned",
      componentCleanup: "component-known-work-complete",
      componentResiduals: "component-residuals-unverifiable",
      fullDeletionProven: false,
    });
    expect(fixture.currentRun().state).toMatchObject({
      cleanup: "product-cleaned",
      componentCleanup: "component-known-work-complete",
      componentResiduals: "component-residuals-unverifiable",
    });
  });

  it("refuses canceled cleanup while exposed action work remains", async () => {
    const fixture = lifecycleHarness(
      terminalRun({
        execution: "canceled",
        priorGenerationQuiescence: "pending",
      }),
    );
    vi.mocked(fixture.ports.component.status).mockResolvedValue({
      type: "canceled",
    });
    vi.mocked(fixture.ports.inspectQuiescence).mockResolvedValue({
      inProgressSteps: ["action.v3"],
      inProgressChildren: [],
    });
    await expect(
      fixture.controls.cleanup(principal, {
        workflowRunId: "run-a",
        reasonCode: "operator-request",
        occurredAt: 200,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(fixture.ports.component.cleanup).not.toHaveBeenCalled();
  });
});
