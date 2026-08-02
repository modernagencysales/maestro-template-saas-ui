import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import {
  decodeCompletionContext,
  planCompletionTransition,
} from "../confect/workflows/_kit/completionReconciliation";
import { createWorkflowLifecycleState } from "../confect/workflows/_kit/lifecycleState";

const context = {
  workspaceId: "workspace-1",
  workflowRunId: "run-1",
  workflowId: "workflow-1",
  workflowVersion: 1,
  generation: 0,
  generationAnchor: "workflow-1@v1:g0",
} as const;

describe("workflow completion reconciliation planning", () => {
  it("decodes a bounded completion context into a Result", () => {
    expect(Result.getOrThrow(decodeCompletionContext(context))).toEqual(
      context,
    );
  });

  it("redacts invalid completion context parser details", () => {
    const parsed = decodeCompletionContext({
      ...context,
      workspaceId: "must-not-appear",
      generation: -1,
    });
    expect(Result.isFailure(parsed)).toBe(true);
    if (Result.isFailure(parsed)) {
      expect(parsed.failure).toBe("Completion context is invalid.");
    }
  });

  it("plans successful and rejected terminal transitions", () => {
    const state = createWorkflowLifecycleState(context);
    const terminal = planCompletionTransition(state, "terminal");
    expect(Result.getOrThrow(terminal).execution).toBe("terminal");

    const repeated = planCompletionTransition(
      Result.getOrThrow(terminal),
      "terminal",
    );
    expect(Result.isFailure(repeated)).toBe(true);
  });
});
