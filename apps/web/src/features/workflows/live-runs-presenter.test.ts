import { describe, expect, it } from "vitest";
import { presentLiveRuns, type LiveRunsOverview } from "./live-runs-presenter";

const overview = (
  runs: LiveRunsOverview["workflowRuns"],
  workspace: LiveRunsOverview["workspace"] = { name: "Maestro Template Demo" },
): LiveRunsOverview => ({ workspace, workflowRuns: runs });

const run = (
  id: string,
  startedAt: number,
  status = "completed",
): LiveRunsOverview["workflowRuns"][number] => ({
  _id: id,
  workflowId: "source-grounded-brief",
  workflowVersion: 3,
  status,
  startedAt,
});

describe("presentLiveRuns", () => {
  it("maps skipped to unconfigured and loading to connecting", () => {
    expect(presentLiveRuns({ status: "skipped" })).toEqual({
      kind: "unconfigured",
    });
    expect(presentLiveRuns({ status: "loading" })).toEqual({
      kind: "connecting",
    });
  });

  it("maps every failure shape to unavailable", () => {
    expect(
      presentLiveRuns({ status: "typed_failure", error: { _tag: "Boom" } }),
    ).toMatchObject({ kind: "unavailable" });
    expect(
      presentLiveRuns({
        status: "transport_failure",
        error: new TypeError("fetch failed"),
        message: "fetch failed",
      }),
    ).toEqual({ kind: "unavailable", detail: "fetch failed" });
  });

  it("treats a missing demo workspace as unseeded", () => {
    expect(
      presentLiveRuns({
        status: "ready",
        mode: "read",
        data: overview([], null),
      }),
    ).toEqual({ kind: "unseeded" });
  });

  it("sorts ready rows newest-first and keeps identity keys", () => {
    const view = presentLiveRuns({
      status: "ready",
      mode: "read",
      data: overview([
        run("older", 1, "completed"),
        run("newest", 3, "queued"),
        run("middle", 2, "running"),
      ]),
    });

    expect(view).toMatchObject({
      kind: "ready",
      workspaceName: "Maestro Template Demo",
      runCount: 3,
    });
    if (view.kind === "ready") {
      expect(view.rows.map((row) => row.key)).toEqual([
        "newest",
        "middle",
        "older",
      ]);
      expect(view.rows[0]?.startedAtLabel).toBe("1970-01-01T00:00:00.003Z");
    }
  });
});
