import * as Exit from "effect/Exit";
import { describe, expect, it } from "vitest";

import { decodeDurableWorkflowGraphV2 } from "../confect/workflows/graphSchemaCurrent";
import { decodeDurableWorkflowGraphV2 as decodeCanonicalWorkflowGraphV2 } from "../confect/workflows/graphSchema";

const payloadPolicy = {
  maxInputBytes: 64_000,
  maxResultBytes: 64_000,
  resultMode: "inline",
} as const;

const validGraph = {
  schemaVersion: 2,
  id: "workflow_v2_receipt",
  version: 2,
  startNodeId: "source",
  argsSchemaName: "workflowV2Receipt.v2.args",
  returnSchemaName: "workflowV2Receipt.v2.return",
  principalSchemaName: "workflowPrincipal.v1",
  policyPosture: {
    kind: "none",
    reason: "No policy-dependent decisions.",
  },
  kickoffProfiles: [
    { name: "interactive", mode: "eager-first-poll", default: true },
  ],
  unstableArgs: { enabled: false },
  nodes: [
    {
      id: "source",
      kind: "source",
      label: "Source",
      stepName: "source.v2",
      payloadPolicy,
      semanticRuleIds: ["WF-NODE-KIND"],
    },
    {
      id: "receipt",
      kind: "output",
      label: "Receipt",
      stepName: "receipt.v2",
      payloadPolicy,
      semanticRuleIds: ["WF-NODE-KIND"],
    },
  ],
  edges: [
    {
      id: "source_receipt",
      sourceNodeId: "source",
      targetNodeId: "receipt",
    },
  ],
  joins: [],
} as const;

describe("durable workflow graph V2 parser", () => {
  it("keeps strict graph parsing in Exit", () => {
    const decoded = decodeDurableWorkflowGraphV2(validGraph);
    expect(Exit.isSuccess(decoded)).toBe(true);
    if (Exit.isSuccess(decoded)) expect(decoded.value).toEqual(validGraph);

    expect(
      Exit.isFailure(
        decodeDurableWorkflowGraphV2({ ...validGraph, schemaVersion: 1 }),
      ),
    ).toBe(true);
    expect(
      Exit.isFailure(
        decodeDurableWorkflowGraphV2({ ...validGraph, unexpected: true }),
      ),
    ).toBe(true);
  });

  it("keeps the canonical graph schema aligned with the current parser", () => {
    const decoded = decodeCanonicalWorkflowGraphV2(validGraph);
    expect(Exit.isSuccess(decoded)).toBe(true);
    if (Exit.isSuccess(decoded)) expect(decoded.value).toEqual(validGraph);
    expect(
      Exit.isFailure(
        decodeCanonicalWorkflowGraphV2({ ...validGraph, unexpected: true }),
      ),
    ).toBe(true);
  });
});
