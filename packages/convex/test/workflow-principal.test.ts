import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { WorkflowRunRow } from "../confect/tables/workflowRuns";
import {
  DurableWorkflowPrincipal,
  adaptLegacyActiveWorkflowPrincipal,
  assertWorkflowPrincipalAuthority,
  createWorkflowSystemPrincipal,
  createWorkflowUserPrincipal,
} from "../confect/workflows/_kit/principal";
import {
  assertWorkflowPolicySnapshot,
  policyPosture,
  resolveWorkflowPolicySnapshot,
} from "../confect/workflows/_kit/policySnapshot";

describe("durable workflow principal authority", () => {
  it("constructs a versioned user principal from server-owned fields", () => {
    const principal = createWorkflowUserPrincipal({
      workspaceId: "workspace-a",
      actorId: "user-a",
      role: "editor",
      grants: ["brief:write", "workflow:start"],
      authEpoch: 7,
      kickoffAt: 100,
    });
    expect(
      Schema.decodeUnknownSync(DurableWorkflowPrincipal)(principal),
    ).toEqual(principal);
    expect(principal).toMatchObject({
      version: 2,
      provenance: "authenticated-workflow-start",
    });
    expect(JSON.stringify(principal)).not.toMatch(/token|credential|payload/i);
  });

  it("fails opaquely on cross-workspace and missing grants", () => {
    const principal = userPrincipal();
    for (const authority of [
      { workspaceId: "workspace-b", requiredGrants: ["workflow:start"] },
      { workspaceId: "workspace-a", requiredGrants: ["workflow:admin"] },
    ]) {
      expect(() =>
        assertWorkflowPrincipalAuthority(principal, authority),
      ).toThrow("Workflow principal is unavailable.");
    }
  });

  it("prevents duplicate grants and user-only system grants", () => {
    expect(() =>
      createWorkflowUserPrincipal({
        ...userInput,
        grants: ["workflow:start", "workflow:start"],
      }),
    ).toThrow(/unique/i);
    expect(() =>
      createWorkflowSystemPrincipal({
        workspaceId: "workspace-a",
        systemId: "retention",
        reason: "bounded sweep",
        grants: ["user:impersonate"],
        kickoffAt: 100,
      }),
    ).toThrow(/user grants/i);
  });

  it("restricts legacy active runs to reauthorization", () => {
    expect(
      adaptLegacyActiveWorkflowPrincipal({
        workspaceId: "workspace-a",
        startedByUserId: "user-a",
        startedAt: 100,
      }),
    ).toMatchObject({ consequentialEffects: "reauthorization-required" });
  });
});

describe("pinned workflow policy snapshots", () => {
  it("keeps a resolved policy stable and rejects hash drift", async () => {
    const posture = policyPosture.pinned({
      schemaName: "briefPolicy.v1",
      policyVersionId: "policy-v3",
      policyHash: "sha256:stable",
    });
    const snapshot = await resolveWorkflowPolicySnapshot(posture, {
      resolvedAt: 100,
      resolvePinned: async () => ({ policyHash: "sha256:stable" }),
    });
    expect(() => assertWorkflowPolicySnapshot(posture, snapshot)).not.toThrow();
    await expect(
      resolveWorkflowPolicySnapshot(posture, {
        resolvedAt: 200,
        resolvePinned: async () => ({ policyHash: "sha256:latest" }),
      }),
    ).rejects.toThrow(/unavailable/i);
  });

  it("preserves nullable migration fields for legacy runs", () => {
    expect(
      Schema.decodeUnknownSync(WorkflowRunRow)({
        workspaceId: "workspace-a",
        workflowId: "workflow-a",
        workflowVersion: 1,
        graphJson: "{}",
        status: "running",
        idempotencyKey: "legacy-key",
        startedByUserId: "user-a",
        startedAt: 1,
        completedAt: null,
        failedAt: null,
        trustReceiptId: null,
      }),
    ).not.toHaveProperty("principalSnapshot");
  });
});

const userInput = {
  workspaceId: "workspace-a",
  actorId: "user-a",
  role: "editor",
  grants: ["workflow:start"],
  authEpoch: 7,
  kickoffAt: 100,
} as const;

const userPrincipal = () => createWorkflowUserPrincipal(userInput);
