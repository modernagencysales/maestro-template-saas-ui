import { describe, expect, it, vi } from "vitest";

import {
  hashOperatorCensusAuthorizationPayload,
  type OperatorCensusAuthorization,
  type OperatorCensusAuthorizationPayload,
  type WorkflowCensusRun,
} from "./census.js";
import {
  handleOperatorWorkflowCensus,
  type OperatorCensusEndpointDependencies,
} from "./censusEndpoint.js";

const now = 9_000_000;
const digest = (character: string) => `sha256:${character.repeat(64)}`;

const authorization = (
  overrides: Partial<OperatorCensusAuthorizationPayload> = {},
): OperatorCensusAuthorization => {
  const payload: OperatorCensusAuthorizationPayload = {
    schemaVersion: 1,
    kind: "operator-workflow-census-authorization",
    principalClass: "operator",
    environment: "production",
    targetId: "customer-app",
    commitSha: "a".repeat(40),
    artifactHash: digest("b"),
    issuedAt: now,
    expiresAt: now + 10_000,
    nonce: "census_authority_0002",
    ...overrides,
  };
  return {
    ...payload,
    canonicalHash: hashOperatorCensusAuthorizationPayload(payload),
  };
};

const request = (auth: OperatorCensusAuthorization) => ({
  environment: auth.environment,
  targetId: auth.targetId,
  commitSha: auth.commitSha,
  artifactHash: auth.artifactHash,
  authorization: auth,
});

const run = (): WorkflowCensusRun => ({
  runFingerprint: digest("1"),
  workflowId: "billing-workflow",
  workflowVersion: 3,
  status: "active",
  runnerHash: digest("c"),
  runtimeHash: digest("d"),
  capabilityBindingsHash: digest("e"),
  completionBindingHash: digest("f"),
});

const dependencies = (
  auth: OperatorCensusAuthorization,
  runs: readonly WorkflowCensusRun[] = [],
): OperatorCensusEndpointDependencies => ({
  authorizeCurrentOperator: vi.fn(async () => ({
    kind: "authorized" as const,
    authorization: auth,
  })),
  loadActiveRestartableRuns: vi.fn(async () => ({
    kind: "available" as const,
    runs,
  })),
  nowMs: () => now + 1,
});

describe("authorized operator workflow census endpoint", () => {
  it("returns only the bound explicit no-workflows artifact", async () => {
    const auth = authorization();
    const deps = dependencies(auth);
    const result = await handleOperatorWorkflowCensus(request(auth), deps);
    expect(result).toMatchObject({
      kind: "ok",
      census: {
        kind: "authorized-workflow-census",
        outcome: "no-workflows",
        environment: "production",
        targetId: "customer-app",
        authorizationHash: auth.canonicalHash,
        active: 0,
        restartable: 0,
        runs: [],
      },
    });
    expect(Object.keys(result).sort()).toEqual(["census", "kind"]);
    expect(deps.authorizeCurrentOperator).toHaveBeenCalledOnce();
    expect(deps.loadActiveRestartableRuns).toHaveBeenCalledWith({
      scope: {
        environment: "production",
        targetId: "customer-app",
        commitSha: auth.commitSha,
        artifactHash: auth.artifactHash,
      },
      authorizationHash: auth.canonicalHash,
    });
  });

  it("returns the bound non-empty census without projecting raw operator identity", async () => {
    const auth = authorization();
    const result = await handleOperatorWorkflowCensus(
      request(auth),
      dependencies(auth, [run()]),
    );
    expect(result).toMatchObject({
      kind: "ok",
      census: {
        outcome: "workflows-present",
        active: 1,
        restartable: 0,
        runs: [
          expect.objectContaining({
            workflowId: "billing-workflow",
            workflowVersion: 3,
          }),
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/userId|email|tokenIdentifier/);
  });

  it("denies before census access when current operator authorization fails", async () => {
    const auth = authorization();
    const loadActiveRestartableRuns = vi.fn(async () => ({
      kind: "available" as const,
      runs: [],
    }));
    const result = await handleOperatorWorkflowCensus(request(auth), {
      authorizeCurrentOperator: async () => ({ kind: "denied" }),
      loadActiveRestartableRuns,
      nowMs: () => now + 1,
    });
    expect(result).toMatchObject({ kind: "blocked", code: "unauthorized" });
    expect(loadActiveRestartableRuns).not.toHaveBeenCalled();
  });

  it("denies stale, tampered, or scope-mismatched authorization before census access", async () => {
    const auth = authorization();
    for (const [candidate, current, clock] of [
      [auth, auth, auth.expiresAt],
      [{ ...auth, targetId: "other-app" }, auth, now + 1],
      [auth, authorization({ environment: "staging" }), now + 1],
    ] as const) {
      const deps = dependencies(current);
      const result = await handleOperatorWorkflowCensus(
        { ...request(auth), authorization: candidate },
        { ...deps, nowMs: () => clock },
      );
      expect(result).toMatchObject({ kind: "blocked", code: "unauthorized" });
      expect(deps.loadActiveRestartableRuns).not.toHaveBeenCalled();
    }
  });

  it("rejects open requests before authorization", async () => {
    const auth = authorization();
    const deps = dependencies(auth);
    const result = await handleOperatorWorkflowCensus(
      { ...request(auth), userId: "caller-controlled" },
      deps,
    );
    expect(result).toMatchObject({
      kind: "blocked",
      code: "invalid-request",
    });
    expect(deps.authorizeCurrentOperator).not.toHaveBeenCalled();
    expect(deps.loadActiveRestartableRuns).not.toHaveBeenCalled();
  });

  it("fails closed when census reading throws or returns invalid bindings", async () => {
    const auth = authorization();
    const throwing = {
      ...dependencies(auth),
      loadActiveRestartableRuns: async () => {
        throw new Error("unavailable");
      },
    };
    expect(
      await handleOperatorWorkflowCensus(request(auth), throwing),
    ).toMatchObject({ kind: "blocked", code: "census-unavailable" });

    const invalid = dependencies(auth, [
      { ...run(), completionBindingHash: "missing" },
    ]);
    expect(
      await handleOperatorWorkflowCensus(request(auth), invalid),
    ).toMatchObject({ kind: "blocked", code: "census-unavailable" });
  });
});
