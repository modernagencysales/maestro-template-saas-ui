import * as Exit from "effect/Exit";
import { describe, expect, it } from "vitest";

import {
  decodeWorkflowOnCompleteContext,
  deriveGenerationAnchor,
} from "../confect/workflows/_kit/lifecycleState";

describe("workflow lifecycle completion context parser", () => {
  it("keeps parser success and failure in Exit", () => {
    const valid = {
      workspaceId: "workspace-a",
      workflowRunId: "run-a",
      workflowId: "workflow.invoice",
      workflowVersion: 3,
      generation: 0,
      generationAnchor: deriveGenerationAnchor("workflow.invoice", 3, 0),
    };

    const decoded = decodeWorkflowOnCompleteContext(valid);
    expect(Exit.isSuccess(decoded)).toBe(true);
    if (Exit.isSuccess(decoded)) expect(decoded.value).toEqual(valid);
    expect(
      Exit.isFailure(
        decodeWorkflowOnCompleteContext({ ...valid, workflowVersion: -1 }),
      ),
    ).toBe(true);
  });
});
