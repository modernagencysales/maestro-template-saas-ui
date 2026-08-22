import { describe, expect, it } from "vitest";

import { runBoundedWorkflowRetentionSweep } from "../confect/workflows/_kit/lifecycleSweep";
import {
  lifecycleHarness,
  principal,
  terminalRun,
} from "./workflow-lifecycle-controls.fixture";

describe("bounded workflow retention sweep", () => {
  it("uses the cleanup retention guard and returns a bounded redacted page", async () => {
    const fixture = lifecycleHarness(terminalRun());
    const result = await runBoundedWorkflowRetentionSweep(
      fixture.controls,
      principal,
      { cursor: null, limit: 1, occurredAt: 150 },
    );
    expect(result).toEqual({
      accepted: ["run-a"],
      refused: [],
      isDone: true,
      continueCursor: "",
    });
    expect(fixture.ports.component.cleanup).toHaveBeenCalledTimes(1);
  });

  it("refuses rather than bypassing an active retention window", async () => {
    const fixture = lifecycleHarness(terminalRun());
    const result = await runBoundedWorkflowRetentionSweep(
      fixture.controls,
      principal,
      { cursor: null, limit: 1, occurredAt: 149 },
    );
    expect(result).toMatchObject({ accepted: [], refused: ["run-a"] });
    expect(fixture.ports.component.cleanup).not.toHaveBeenCalled();
  });
});
