import { describe, expect, it } from "vitest";

import {
  buildContractReproofRequest,
  validateContractReproofRequest,
} from "../src/contract-reproof.js";

const identity = {
  controlHeadSha: "a".repeat(40),
  planSha256: "b".repeat(64),
  taskBlockHash: "c".repeat(64),
  taskId: "S13-T01",
};

const request = () =>
  buildContractReproofRequest({
    ...identity,
    priorArchiveSha256: "d".repeat(64),
    priorIntegrationHeadSha: "e".repeat(40),
    priorIntegrationId: "C1-contract-spine",
    priorIntegrationResultSha256: "f".repeat(64),
    priorLaneResultSha256: "1".repeat(64),
    priorEvidencePath: "/tmp/evidence/prior.json",
    reason: "canonical task block gained stronger fixture requirements",
  });

describe("contract reproof provenance", () => {
  it("binds a deterministic request to old and current authority", () => {
    const value = request();
    expect(validateContractReproofRequest(value, identity)).toEqual(value);
    expect(request()).toEqual(value);
  });

  it.each([
    ["task", { ...identity, taskId: "S13-T02" }],
    ["control head", { ...identity, controlHeadSha: "2".repeat(40) }],
    ["plan", { ...identity, planSha256: "2".repeat(64) }],
    ["task block", { ...identity, taskBlockHash: "2".repeat(64) }],
  ])("rejects mismatched current %s authority", (_label, expected) => {
    expect(() => validateContractReproofRequest(request(), expected)).toThrow(
      /current authority/,
    );
  });

  it("rejects mutation and unsafe identities", () => {
    expect(() =>
      validateContractReproofRequest(
        { ...request(), reason: "mutated after signing" },
        identity,
      ),
    ).toThrow(/hash mismatch/);
    expect(() =>
      buildContractReproofRequest({ ...request(), taskId: "../S13-T01" }),
    ).toThrow(/safe segment/);
  });
});
