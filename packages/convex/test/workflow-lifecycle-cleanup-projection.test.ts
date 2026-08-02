import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import {
  createWorkflowLifecycleState,
  transitionWorkflowLifecycle,
  type WorkflowLifecycleCommand,
  type WorkflowLifecycleState,
} from "../confect/workflows/_kit/lifecycleState";

describe("workflow lifecycle honest product cleanup projection", () => {
  it("records known exposed completion and hidden residual uncertainty separately", () => {
    let state = createWorkflowLifecycleState({
      workspaceId: "workspace-a",
      workflowRunId: "run-a",
      workflowId: "workflow.invoice",
      workflowVersion: 3,
      execution: "terminal",
      priorGenerationQuiescence: "quiescent",
      cleanup: "in-progress",
      componentCleanup: "component-cleanup-requested",
    });
    state = apply(state, command("mark-component-known-work-complete"));
    state = apply(state, command("mark-component-residuals-unverifiable"));
    state = apply(state, command("mark-product-cleaned"));

    expect(state).toMatchObject({
      cleanup: "product-cleaned",
      componentCleanup: "component-known-work-complete",
      componentResiduals: "component-residuals-unverifiable",
    });
  });
});

const command = (
  kind: Extract<
    WorkflowLifecycleCommand["kind"],
    | "mark-component-known-work-complete"
    | "mark-component-residuals-unverifiable"
    | "mark-product-cleaned"
  >,
): WorkflowLifecycleCommand => ({
  kind,
  workspaceId: "workspace-a",
  workflowRunId: "run-a",
  generation: 0,
});

const apply = (
  state: WorkflowLifecycleState,
  lifecycleCommand: WorkflowLifecycleCommand,
) => Result.getOrThrow(transitionWorkflowLifecycle(state, lifecycleCommand));
