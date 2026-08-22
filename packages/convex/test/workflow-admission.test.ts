import * as Effect from "effect/Effect";
import type { FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import {
  decodeAdmissionError,
  handleExistingWorkflowRun,
  sameWorkflowStartBinding,
  workflowStartBindingHash,
} from "../confect/workflows/_kit/ownership";
import {
  createWorkflowSystemPrincipal,
  createWorkflowUserPrincipal,
} from "../confect/workflows/_kit/principal";
import {
  decideWorkflowAdmission,
  workflowAdmissionPolicy,
  type WorkflowAdmissionPolicy,
} from "../confect/workflows/_kit/workflowAdmission";

const tinyPolicy: WorkflowAdmissionPolicy = {
  user: { maxActive: 1, maxQueued: 2, retryAfterMs: 10 },
  system: { maxActive: 1, maxQueued: 1, retryAfterMs: 20 },
};

const systemPrincipal = createWorkflowSystemPrincipal({
  workspaceId: "workspace-a",
  systemId: "scheduler",
  reason: "scheduled fixture",
  grants: ["workflow:start"],
  kickoffAt: 1,
});
const systemPrincipalLater = createWorkflowSystemPrincipal({
  workspaceId: "workspace-a",
  systemId: "scheduler",
  reason: "scheduled fixture",
  grants: ["workflow:start"],
  kickoffAt: 999,
});
const userPrincipal = createWorkflowUserPrincipal({
  workspaceId: "workspace-a",
  actorId: "user-a",
  role: "admin",
  grants: ["workflow:start"],
  authEpoch: 1,
  kickoffAt: 1,
});

const startBindingInput = (overrides: Record<string, unknown> = {}) =>
  ({
    workflowRef: {} as FunctionReference<"mutation", "internal">,
    workflowArgs: { input: { alpha: 1, beta: 2 } },
    workspaceId: "workspace-a",
    workflowId: "workflow.fixture",
    workflowVersion: 1,
    graphJson: '{"nodes":[]}',
    idempotencyKey: "same-key",
    startedByUserId: "user-a",
    startedAt: 1,
    kickoffProfile: "queued" as const,
    principalSnapshot: userPrincipal,
    ...overrides,
  }) as Parameters<typeof workflowStartBindingHash>[0];

describe("workflow admission policy", () => {
  it("derives a narrow independent system lane", () => {
    expect(workflowAdmissionPolicy(20)).toEqual({
      user: { maxActive: 20, maxQueued: 80, retryAfterMs: 5_000 },
      system: { maxActive: 5, maxQueued: 10, retryAfterMs: 30_000 },
    });
  });

  it("reports active and queued saturation with retry guidance", () => {
    expect(
      decideWorkflowAdmission("user", { active: 1, queued: 0 }, tinyPolicy),
    ).toEqual({
      kind: "deny",
      lane: "user",
      saturated: "active",
      active: 1,
      queued: 0,
      limit: 1,
      retryAfterMs: 10,
    });
    expect(
      decideWorkflowAdmission("system", { active: 0, queued: 1 }, tinyPolicy),
    ).toMatchObject({ kind: "deny", lane: "system", saturated: "queued" });
  });

  it("preserves unknown component defects without coercing them", () => {
    const defect = new Error("component transport unavailable");
    expect(decodeAdmissionError(defect)).toBe(defect);
  });
});

describe("immutable workflow start binding", () => {
  it("ignores volatile principal and policy resolution timestamps", () => {
    const pinnedPolicy = {
      version: 1 as const,
      kind: "pinned" as const,
      schemaName: "workspace-policy",
      policyVersionId: "policy-v1",
      policyHash: "hash-v1",
      resolvedAt: 1,
    };
    const baseline = workflowStartBindingHash(
      startBindingInput({
        principalSnapshot: systemPrincipal,
        policySnapshot: pinnedPolicy,
      }),
      "same-key",
    );
    expect(
      workflowStartBindingHash(
        startBindingInput({
          principalSnapshot: systemPrincipalLater,
          policySnapshot: { ...pinnedPolicy, resolvedAt: 999 },
          startedAt: 999,
        }),
        "same-key",
      ),
    ).toBe(baseline);
  });

  it("returns the existing component for the same intent at a later time", async () => {
    const first = startBindingInput({ principalSnapshot: systemPrincipal });
    const later = startBindingInput({
      principalSnapshot: systemPrincipalLater,
      startedAt: 999,
    });
    const startBindingHash = workflowStartBindingHash(first, "same-key");
    await expect(
      Effect.runPromise(
        handleExistingWorkflowRun(
          {
            workflowId: first.workflowId,
            workflowVersion: first.workflowVersion,
            admissionLane: "system",
            startBindingHash,
            componentWorkflowId: "component-existing",
          },
          {
            ...later,
            admissionLane: "system",
            startBindingHash: workflowStartBindingHash(later, "same-key"),
          },
        ),
      ),
    ).resolves.toBe("component-existing");
  });

  it("binds version, arguments, principal, and derived lane", () => {
    const baseline = workflowStartBindingHash(startBindingInput(), "same-key");
    expect(
      workflowStartBindingHash(
        startBindingInput({ workflowVersion: 2 }),
        "same-key",
      ),
    ).not.toBe(baseline);
    expect(
      workflowStartBindingHash(
        startBindingInput({ workflowArgs: { input: { alpha: 9, beta: 2 } } }),
        "same-key",
      ),
    ).not.toBe(baseline);
    expect(
      workflowStartBindingHash(
        startBindingInput({ principalSnapshot: systemPrincipal }),
        "same-key",
      ),
    ).not.toBe(baseline);
    expect(
      workflowStartBindingHash(
        startBindingInput({
          policySnapshot: {
            version: 1,
            kind: "pinned",
            schemaName: "workspace-policy",
            policyVersionId: "policy-v2",
            policyHash: "hash-v2",
            resolvedAt: 1,
          },
        }),
        "same-key",
      ),
    ).not.toBe(baseline);
  });

  it("canonicalizes reordered object keys", () => {
    expect(workflowStartBindingHash(startBindingInput(), "same-key")).toBe(
      workflowStartBindingHash(
        startBindingInput({ workflowArgs: { input: { beta: 2, alpha: 1 } } }),
        "same-key",
      ),
    );
  });

  it("accepts exact replay and fails closed for mismatch or legacy rows", () => {
    const input = startBindingInput();
    const hash = workflowStartBindingHash(input, "same-key");
    const replay = {
      workflowId: input.workflowId,
      workflowVersion: input.workflowVersion,
      admissionLane: "user" as const,
      startBindingHash: hash,
    };
    expect(
      sameWorkflowStartBinding(replay, { ...replay, startBindingHash: hash }),
    ).toBe(true);
    expect(
      sameWorkflowStartBinding(replay, {
        ...replay,
        startBindingHash: "different",
      }),
    ).toBe(false);
    expect(
      sameWorkflowStartBinding(
        { ...replay, startBindingHash: null },
        { ...replay, startBindingHash: hash },
      ),
    ).toBe(false);
  });
});
