import { describe, expect, it } from "vitest";

import { createWorkflowLifecycleControls } from "../confect/workflows/_kit/lifecycle";
import {
  lifecycleHarness,
  principal,
} from "./workflow-lifecycle-controls.fixture";

describe("tenant-safe workflow lifecycle projections", () => {
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
      const fixture = lifecycleHarness();
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

  it("rejects invalid pagination before product queries", async () => {
    const fixture = lifecycleHarness();
    await expect(
      fixture.controls.list(principal, { cursor: null, limit: 101 }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(fixture.ports.listOwnedRuns).not.toHaveBeenCalled();
  });
});
