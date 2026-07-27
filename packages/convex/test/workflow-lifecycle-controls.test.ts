import { describe, expect, it } from "vitest";

import {
  lifecycleHarness,
  principal,
} from "./workflow-lifecycle-controls.fixture";

describe("tenant-safe workflow lifecycle controls", () => {
  it("reauthorizes and cancels an owned run with a redacted audit", async () => {
    const fixture = lifecycleHarness();
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
    const fixture = lifecycleHarness();
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
});
