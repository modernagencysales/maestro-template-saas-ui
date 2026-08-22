import { describe, expect, it, vi } from "vitest";

import { MAESTRO_PAYLOAD_BUDGETS } from "../confect/workflows/_kit/payloadBudget";
import {
  RedactedWorkflowCapabilityError,
  runWorkflowCapabilityBoundary,
} from "../confect/workflows/_kit/workflowCapabilityBoundary";
import {
  assertConsequentialWorkflowAuthority,
  createWorkflowUserPrincipal,
} from "../confect/workflows/_kit/principal";

const inlinePolicy = {
  maxResultBytes: 32_768,
  resultMode: "inline" as const,
};

describe("generated workflow capability payload boundary", () => {
  it("rejects oversized arguments before capability dispatch", async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    await expect(
      runWorkflowCapabilityBoundary({
        nodeId: "provider.v1",
        correlationId: "corr_1",
        args: {
          body: "x".repeat(MAESTRO_PAYLOAD_BUDGETS["step-args"].hardBytes),
        },
        payloadPolicy: inlinePolicy,
        predictedJournalBytes: 0,
        observedJournalBytes: 0,
        execute,
      }),
    ).rejects.toMatchObject({
      diagnostic: { surface: "step-args", phase: "pre-dispatch" },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("redacts provider failures before returning to Workpool", async () => {
    const canary = "provider-token-do-not-persist";
    const failure = await runWorkflowCapabilityBoundary({
      nodeId: "provider.v1",
      correlationId: "corr_2",
      args: {},
      payloadPolicy: inlinePolicy,
      predictedJournalBytes: 0,
      observedJournalBytes: 0,
      execute: async () => {
        throw new Error(canary);
      },
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RedactedWorkflowCapabilityError);
    expect(JSON.stringify(failure)).not.toContain(canary);
    expect(failure).toMatchObject({
      diagnostic: { code: "WORKFLOW_CAPABILITY_FAILED" },
    });
  });

  it("returns only a persisted artifact reference for artifact results", async () => {
    const raw = { body: "large provider output" };
    const result = await runWorkflowCapabilityBoundary({
      nodeId: "archive.v1",
      correlationId: "corr_3",
      args: {},
      payloadPolicy: {
        maxResultBytes: 0,
        resultMode: "artifact-reference",
      },
      predictedJournalBytes: 0,
      observedJournalBytes: 0,
      execute: async () => raw,
      persistArtifact: async (value) => {
        expect(value).toBe(raw);
        return {
          artifactId: "artifact_1",
          contentHash: "a".repeat(64),
          measuredBytes: 128,
          sensitivity: "confidential",
        };
      },
    });
    expect(result.result).toEqual({
      artifactId: "artifact_1",
      contentHash: "a".repeat(64),
      measuredBytes: 128,
      sensitivity: "confidential",
    });
    expect(JSON.stringify(result.result)).not.toContain(raw.body);
  });

  it("blocks a revoked consequential effect before provider dispatch", async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const principal = createWorkflowUserPrincipal({
      workspaceId: "workspace-a",
      actorId: "user-a",
      role: "editor",
      grants: ["provider:write"],
      authEpoch: 4,
      kickoffAt: 1,
    });
    await expect(
      runWorkflowCapabilityBoundary({
        nodeId: "provider.v1",
        correlationId: "corr_4",
        args: {},
        payloadPolicy: inlinePolicy,
        predictedJournalBytes: 0,
        observedJournalBytes: 0,
        consequential: true,
        reauthorize: async () =>
          assertConsequentialWorkflowAuthority(
            principal,
            {
              active: false,
              workspaceId: "workspace-a",
              actorId: "user-a",
              role: "editor",
              grants: ["provider:write"],
              authEpoch: 5,
            },
            ["provider:write"],
          ),
        execute,
      }),
    ).rejects.toMatchObject({
      diagnostic: { code: "WORKFLOW_CAPABILITY_FAILED" },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
