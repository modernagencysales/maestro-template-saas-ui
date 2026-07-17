import { describe, expect, it } from "vitest";

import { validateFinalLaneResult } from "../src/lane-result.js";

const taskId = "S04-T01";
const currentHeadSha = "a".repeat(40);
const validResult = {
  schemaVersion: "maestro-brain-lane-result/v1",
  taskId,
  headSha: currentHeadSha,
  status: "lane_green",
};

describe("final lane result", () => {
  it("accepts an exact task, green status, and current-head binding", () => {
    expect(() =>
      validateFinalLaneResult(validResult, { currentHeadSha, taskId }),
    ).not.toThrow();
  });

  it.each([
    [
      "schema",
      { ...validResult, schemaVersion: "maestro-brain-lane-result/v0" },
    ],
    ["task", { ...validResult, taskId: "S04-T02" }],
    ["status", { ...validResult, status: "integrated" }],
    ["head", { ...validResult, headSha: "b".repeat(40) }],
  ])("rejects an adversarial %s mismatch", (_label, result) => {
    expect(() =>
      validateFinalLaneResult(result, { currentHeadSha, taskId }),
    ).toThrow();
  });

  it("accepts complete reproof lineage and rejects partial lineage", () => {
    const reproof = {
      priorIntegrationHeadSha: "b".repeat(40),
      priorIntegrationId: "wave-000001",
      requestPath: "/tmp/evidence/reproofs/S04-T01/request.json",
      requestSha256: "c".repeat(64),
    };
    expect(() =>
      validateFinalLaneResult(
        { ...validResult, reproof },
        { currentHeadSha, taskId },
      ),
    ).not.toThrow();
    expect(() =>
      validateFinalLaneResult(
        { ...validResult, reproof: { ...reproof, requestSha256: "short" } },
        { currentHeadSha, taskId },
      ),
    ).toThrow(/lineage is incomplete/);
  });
});
