import { v } from "convex/values";
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import {
  planMaestroWorkflowDefinition,
  type MaestroWorkflowMetadata,
} from "../confect/workflows/_kit/defineMaestroWorkflow";
import { kickoffProfileStartOptions } from "../confect/workflows/_kit/kickoffProfiles";
import {
  workflowWorkpoolConfigurationFindings,
  workflowWorkpoolOptions,
} from "../confect/workflows/_kit/workpoolConfig";

const metadata = {
  workflowId: "workflow_source_to_receipt",
  workflowVersion: 2,
  runtimeVersion: "maestro-graph-v2",
  argsSchemaName: "sourceToReceipt.v2.args",
  returnSchemaName: "sourceToReceipt.v2.return",
  principalSchemaName: "workflowPrincipal.v1",
  policyPosture: {
    kind: "none",
    reason: "No policy-dependent decisions.",
  },
  kickoffProfiles: [
    { name: "interactive", mode: "eager-first-poll", default: true },
    { name: "bulk", mode: "queued", default: false },
  ],
  semanticRuleIds: ["WF-DEFINE", "WF-START-EAGER", "WF-START-QUEUED"],
  semanticCoverage: {
    "WF-DEFINE": {
      posture: "generated",
      constructor: "defineMaestroWorkflow",
      compiler: "generated component runner",
      fixture: "workflow-definition.test.ts",
    },
    "WF-START-EAGER": {
      posture: "generated",
      constructor: "eagerFirstPollProfile",
      compiler: "startAsync false",
      fixture: "workflow-definition.test.ts",
    },
    "WF-START-QUEUED": {
      posture: "generated",
      constructor: "queuedProfile",
      compiler: "startAsync true",
      fixture: "workflow-definition.test.ts",
    },
  },
} as const satisfies MaestroWorkflowMetadata;

describe("defineMaestroWorkflow planning boundary", () => {
  it("maps named kickoff profiles to fixed component start options", () => {
    expect(kickoffProfileStartOptions("eager-first-poll")).toEqual({
      startAsync: false,
    });
    expect(kickoffProfileStartOptions("queued")).toEqual({ startAsync: true });
  });
  it("requires concrete validators and forces action retries off by default", () => {
    const result = planMaestroWorkflowDefinition(
      {
        args: { request: v.string() },
        returns: v.object({ receiptId: v.string() }),
      },
      metadata,
    );

    expect(Result.getOrThrow(result).definition.workpoolOptions).toEqual(
      expect.objectContaining({
        retryActionsByDefault: false,
        maxParallelism: expect.any(Number),
        logLevel: expect.any(String),
      }),
    );
  });

  it("uses one explicit bounded Workpool posture per environment", () => {
    expect(workflowWorkpoolOptions("test")).toEqual({
      maxParallelism: 4,
      logLevel: "WARN",
      retryActionsByDefault: false,
    });
    expect(workflowWorkpoolOptions("production")).toEqual({
      maxParallelism: 20,
      logLevel: "REPORT",
      retryActionsByDefault: false,
    });
  });

  it("rejects conflicting component Workpool configurations before deploy", () => {
    expect(
      workflowWorkpoolConfigurationFindings("test", [
        {
          component: "workflow-primary",
          options: workflowWorkpoolOptions("test"),
        },
        {
          component: "workflow-conflict",
          options: { ...workflowWorkpoolOptions("test"), maxParallelism: 5 },
        },
      ]),
    ).toEqual([
      "workflow-conflict: Workpool configuration conflicts with the test workflow budget",
    ]);
  });

  it("rejects v.any at the workflow return boundary", () => {
    const result = planMaestroWorkflowDefinition(
      { args: { request: v.string() }, returns: v.any() },
      metadata,
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.findings).toContain(
        "return validator cannot be v.any",
      );
    }
  });

  it("rejects missing semantic evidence and invalid default kickoff posture", () => {
    const result = planMaestroWorkflowDefinition(
      {
        args: { request: v.string() },
        returns: v.object({ receiptId: v.string() }),
      },
      {
        ...metadata,
        semanticCoverage: {},
        kickoffProfiles: [{ name: "bulk", mode: "queued", default: true }],
      },
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.findings).toEqual(
        expect.arrayContaining([
          "default kickoff profile must use eager-first-poll",
          "WF-DEFINE: missing semantic evidence",
        ]),
      );
    }
  });
});
