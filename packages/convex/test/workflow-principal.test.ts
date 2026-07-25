import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { WorkflowRunRow } from "../confect/tables/workflowRuns";
import {
  DurableWorkflowPrincipal,
  adaptLegacyActiveWorkflowPrincipal,
  assertConsequentialWorkflowAuthority,
  assertWorkflowPrincipalAuthority,
  createWorkflowSystemPrincipal,
  createWorkflowUserPrincipal,
  resolveWorkflowRunPrincipal,
} from "../confect/workflows/_kit/principal";
import {
  defineWorkflowRoleGrantPolicy,
  projectCurrentWorkflowAuthority,
} from "../confect/workflows/_kit/principalAuthorization";
import {
  assertWorkflowPolicySnapshot,
  policyPosture,
  resolveWorkflowPolicySnapshot,
  workflowPolicyRowHash,
} from "../confect/workflows/_kit/policySnapshot";
import { buildWorkflowCapabilityArgs } from "../confect/workflows/_kit/graphRunnerV2";

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
    expect(
      resolveWorkflowRunPrincipal({
        workspaceId: "workspace-a",
        startedByUserId: "user-a",
        startedAt: 100,
        principalSnapshot: null,
      }),
    ).toMatchObject({ kind: "legacy-active" });
  });

  it("keeps pinned grants while current revocation blocks effects", () => {
    const principal = userPrincipal();
    expect(() =>
      assertConsequentialWorkflowAuthority(
        principal,
        {
          active: true,
          workspaceId: "workspace-a",
          actorId: "user-a",
          role: "editor",
          grants: ["workflow:start"],
          authEpoch: 8,
        },
        ["workflow:start"],
      ),
    ).not.toThrow();
    expect(() =>
      assertConsequentialWorkflowAuthority(
        principal,
        {
          active: false,
          workspaceId: "workspace-a",
          actorId: "user-a",
          role: "editor",
          grants: ["workflow:start"],
          authEpoch: 9,
        },
        ["workflow:start"],
      ),
    ).toThrow("Workflow authority is unavailable.");
  });

  it("derives current grants from membership role policy, never the snapshot", () => {
    const principal = createWorkflowUserPrincipal({
      ...userInput,
      grants: ["provider:write"],
    });
    if (principal.kind !== "user") {
      throw new Error("User principal fixture decoded as a system principal.");
    }
    const access = {
      userId: "user-a",
      workspaceId: "workspace-a",
      role: "editor",
      reason: "direct workspace membership",
      authEpoch: 8,
    } as const;
    const narrowed = defineWorkflowRoleGrantPolicy({
      viewer: [],
      editor: [],
      admin: ["provider:write"],
      owner: ["provider:write"],
    });
    expect(() =>
      assertConsequentialWorkflowAuthority(
        principal,
        projectCurrentWorkflowAuthority(principal, access, narrowed),
        ["provider:write"],
      ),
    ).toThrow("Workflow authority is unavailable.");

    const unchanged = defineWorkflowRoleGrantPolicy({
      ...narrowed,
      editor: ["provider:write"],
    });
    expect(() =>
      assertConsequentialWorkflowAuthority(
        principal,
        projectCurrentWorkflowAuthority(principal, access, unchanged),
        ["provider:write"],
      ),
    ).not.toThrow();
  });

  it("appends authority after rejecting mapped identity overrides", () => {
    const principal = userPrincipal();
    const policySnapshot = { version: 1, kind: "none", reason: "fixture" };
    const envelope = {
      inputs: {},
      context: {},
      node: {} as never,
      principal,
      policySnapshot,
    };
    expect(
      buildWorkflowCapabilityArgs(envelope, { requestId: "request-a" }),
    ).toEqual({
      requestId: "request-a",
      principal,
      policySnapshot,
    });
    expect(() =>
      buildWorkflowCapabilityArgs(envelope, { actorId: "forged" }),
    ).toThrow(/cannot override/i);
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

  it("hashes exact stored policy content for kickoff verification", () => {
    const row = {
      policyKey: "workspace-a:agent.config",
      kind: "agent.config",
      scope: "workspace",
      workspaceId: "workspace-a",
      version: 3,
      dataJson: '{"mode":"review"}',
    };
    expect(workflowPolicyRowHash(row)).toMatch(/^[a-f0-9]{64}$/);
    expect(
      workflowPolicyRowHash({ ...row, dataJson: '{"mode":"live"}' }),
    ).not.toBe(workflowPolicyRowHash(row));
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
