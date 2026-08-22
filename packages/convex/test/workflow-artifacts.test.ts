import { getConvexSize, type Value } from "convex/values";
import * as Exit from "effect/Exit";
import { describe, expect, it } from "vitest";

import { decodeWorkflowArtifactRow } from "../confect/tables/workflowArtifacts";
import {
  WorkflowArtifactContractError,
  assertWorkflowArtifactDeletable,
  fromStoredWorkflowArtifact,
  prepareWorkflowArtifact,
  resolveWorkflowArtifactReference,
  toStoredWorkflowArtifact,
} from "../confect/workflows/_kit/workflowArtifacts";

const run = {
  workspaceId: "workspace-a",
  workflowRunId: "run-a",
  workflowId: "workflow.brief",
  workflowVersion: 2,
  lifecycleGeneration: 1,
  lifecycleExecution: "terminal" as const,
  cleanupState: "product-cleaned" as const,
  parentRetentionUntil: 1_000,
  childRetentionUntil: 1_100,
  evidenceRetentionUntil: 1_200,
};

const draft = (content: Value = { body: "large customer value" }) => ({
  workspaceId: "workspace-a",
  workflowRunId: "run-a",
  workflowId: "workflow.brief",
  workflowVersion: 2,
  lifecycleGeneration: 1,
  referenceKey: "fixture",
  kind: "capability-result" as const,
  sensitivity: "confidential" as const,
  content,
  referenceUntil: 1_200,
  retentionUntil: 1_500,
  createdAt: 500,
});

describe("workflow artifact contract", () => {
  it("measures, canonicalizes, and content-addresses immutable values", () => {
    const first = prepareWorkflowArtifact(run, draft({ b: 2, a: 1 }));
    const reordered = prepareWorkflowArtifact(run, draft({ a: 1, b: 2 }));
    expect(first.contentHash).toBe(reordered.contentHash);
    expect(first.measuredBytes).toBe(getConvexSize({ b: 2, a: 1 }));
    expect(first.appendOnly).toBe(true);
    expect(
      Exit.isSuccess(
        decodeWorkflowArtifactRow(toStoredWorkflowArtifact(first)),
      ),
    ).toBe(true);
  });

  it.each([
    ["workspaceId", "workspace-b", "workspace"],
    ["workflowRunId", "run-b", "run"],
    ["workflowId", "workflow.other", "workflow"],
    ["workflowVersion", 3, "version"],
    ["lifecycleGeneration", 2, "generation"],
  ])("fails closed on wrong %s ownership", (field, value, finding) => {
    expect(
      contractFailure(() =>
        prepareWorkflowArtifact(run, { ...draft(), [field]: value }),
      ),
    ).toMatch(new RegExp(finding, "i"));
  });

  it("rejects invalid retention and oversized artifact documents", () => {
    expect(
      contractFailure(() =>
        prepareWorkflowArtifact(run, {
          ...draft(),
          retentionUntil: 1_100,
        }),
      ),
    ).toMatch(/reference retention/i);
    expect(
      contractFailure(() =>
        prepareWorkflowArtifact(run, draft("x".repeat(900_000))),
      ),
    ).toMatch(/artifact storage limit/i);

    const escaped = prepareWorkflowArtifact(run, draft('"'.repeat(500_000)));
    expect(() => toStoredWorkflowArtifact(escaped)).toThrow(
      WorkflowArtifactContractError,
    );
  });

  it.each([
    ["content", { contentJson: '{"body":"tampered"}' }],
    ["hash", { contentHash: "0".repeat(64) }],
    ["size", { measuredBytes: 1 }],
  ])("rejects tampered stored artifact %s", (_kind, tamper) => {
    const stored = toStoredWorkflowArtifact(
      prepareWorkflowArtifact(run, draft({ body: "trusted" })),
    );
    expect(() => fromStoredWorkflowArtifact({ ...stored, ...tamper })).toThrow(
      WorkflowArtifactContractError,
    );
  });

  it("reuses identical content and rejects reference mutation", () => {
    const existing = {
      _id: "artifact-a",
      ...prepareWorkflowArtifact(run, draft()),
    };
    expect(
      resolveWorkflowArtifactReference(
        existing,
        prepareWorkflowArtifact(run, draft()),
      ),
    ).toEqual({ kind: "existing", artifactId: "artifact-a", row: existing });

    expect(() =>
      resolveWorkflowArtifactReference(
        existing,
        prepareWorkflowArtifact(run, draft({ body: "replacement" })),
      ),
    ).toThrow(WorkflowArtifactContractError);
  });

  it("keeps cross-tenant and wrong-run artifacts opaque", () => {
    const row = { _id: "artifact-a", ...prepareWorkflowArtifact(run, draft()) };
    expect(
      resolveWorkflowArtifactReference(row, {
        workspaceId: "workspace-b",
        workflowRunId: "run-a",
        artifactId: "artifact-a",
      }),
    ).toBeNull();
    expect(
      resolveWorkflowArtifactReference(row, {
        workspaceId: "workspace-a",
        workflowRunId: "run-b",
        artifactId: "artifact-a",
      }),
    ).toBeNull();
  });

  it("blocks deletion while a run or any reference remains live", () => {
    const artifact = prepareWorkflowArtifact(run, draft());
    expect(
      contractFailure(() =>
        assertWorkflowArtifactDeletable(
          {
            ...run,
            lifecycleExecution: "active",
            cleanupState: "not-requested",
          },
          artifact,
          2_000,
        ),
      ),
    ).toMatch(/product cleanup/i);
    expect(
      contractFailure(() =>
        assertWorkflowArtifactDeletable(run, artifact, 1_499),
      ),
    ).toMatch(/retained reference/i);
    expect(
      contractFailure(() =>
        assertWorkflowArtifactDeletable(
          { ...run, evidenceRetentionUntil: 2_500 },
          artifact,
          2_000,
        ),
      ),
    ).toMatch(/retained reference/i);
    expect(
      assertWorkflowArtifactDeletable(run, artifact, 1_500),
    ).toBeUndefined();
  });
});

const contractFailure = (evaluate: () => unknown): string => {
  try {
    evaluate();
  } catch (error) {
    if (error instanceof WorkflowArtifactContractError) return error.reason;
    throw error;
  }
  throw new Error("Expected workflow artifact contract failure.");
};
