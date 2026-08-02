import { describe, expect, it } from "vitest";

import {
  transition,
  WorkflowLifecycleControlError,
} from "../confect/workflows/_kit/lifecycleControls";
import { createWorkflowLifecycleState } from "../confect/workflows/_kit/lifecycleState";

const state = createWorkflowLifecycleState({
  workspaceId: "workspace-1",
  workflowRunId: "run-1",
  workflowId: "workflow-1",
  workflowVersion: 1,
});

describe("workflow lifecycle control transition boundary", () => {
  it("returns a successful guarded lifecycle transition", () => {
    expect(
      transition(state, {
        kind: "mark-terminal",
        workspaceId: state.workspaceId,
        workflowRunId: state.workflowRunId,
        generation: state.generation,
      }).execution,
    ).toBe("terminal");
  });

  it("maps a Result failure to the stable control error", () => {
    expect(() =>
      transition(state, {
        kind: "mark-terminal",
        workspaceId: "other-workspace",
        workflowRunId: state.workflowRunId,
        generation: state.generation,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkflowLifecycleControlError>>({
        _tag: "WorkflowLifecycleControlError",
        code: "INVALID_STATE",
      }),
    );
  });
});
