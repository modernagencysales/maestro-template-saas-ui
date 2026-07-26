import { describe, expect, it } from "vitest";

import {
  compileAuthorizedWorkflowCensus,
  hashOperatorCensusAuthorizationPayload,
  toPromotionWorkflowCensus,
  type OperatorCensusAuthorization,
  type OperatorCensusAuthorizationPayload,
  type WorkflowCensusRun,
} from "./census.js";

const now = 8_000_000;
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
    nonce: "census_authority_0001",
    ...overrides,
  };
  return {
    ...payload,
    canonicalHash: hashOperatorCensusAuthorizationPayload(payload),
  };
};

const run = (
  runFingerprint: string,
  status: WorkflowCensusRun["status"],
): WorkflowCensusRun => ({
  runFingerprint,
  workflowId: "billing-workflow",
  workflowVersion: 4,
  status,
  runnerHash: digest("c"),
  runtimeHash: digest("d"),
  capabilityBindingsHash: digest("e"),
  completionBindingHash: digest("f"),
});

const compile = (
  actual: unknown,
  expected: OperatorCensusAuthorization,
  runs: readonly WorkflowCensusRun[],
  clock = now + 1,
) =>
  compileAuthorizedWorkflowCensus(
    { authorization: actual, expectedAuthorization: expected, runs },
    { nowMs: () => clock },
  );

describe("authorized active/restartable workflow census", () => {
  it("emits the explicit authorized no-workflows result", () => {
    const auth = authorization();
    const first = compile(auth, auth, []);
    const second = compile(auth, auth, []);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: "compiled",
      census: {
        schemaVersion: 1,
        kind: "authorized-workflow-census",
        outcome: "no-workflows",
        environment: "production",
        targetId: "customer-app",
        commitSha: auth.commitSha,
        artifactHash: auth.artifactHash,
        authorizationHash: auth.canonicalHash,
        authorizationNonce: auth.nonce,
        capturedAt: now + 1,
        expiresAt: auth.expiresAt,
        active: 0,
        restartable: 0,
        runs: [],
        fingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      },
    });
    if (first.kind !== "compiled") throw new Error("census must compile");
    expect(toPromotionWorkflowCensus(first.census)).toEqual({
      capturedAt: now + 1,
      active: 0,
      restartable: 0,
      fingerprint: first.census.fingerprint,
    });
    expect(Object.isFrozen(first.census)).toBe(true);
    expect(Object.isFrozen(first.census.runs)).toBe(true);
  });

  it("counts active and restartable runs with every versioned binding", () => {
    const auth = authorization();
    const runs = [
      run(digest("1"), "active"),
      run(digest("2"), "restartable"),
      run(digest("3"), "active"),
    ];
    const result = compile(auth, auth, runs);
    expect(result).toMatchObject({
      kind: "compiled",
      census: {
        outcome: "workflows-present",
        active: 2,
        restartable: 1,
        runs: [
          expect.objectContaining({
            workflowVersion: 4,
            runnerHash: digest("c"),
            runtimeHash: digest("d"),
            capabilityBindingsHash: digest("e"),
            completionBindingHash: digest("f"),
          }),
          expect.any(Object),
          expect.any(Object),
        ],
      },
    });
  });

  it("rejects non-operator, open, and tampered authorization", () => {
    const auth = authorization();
    for (const changed of [
      { ...auth, principalClass: "developer" },
      { ...auth, secret: "must-not-appear" },
      { ...auth, targetId: "other-app" },
    ]) {
      expect(compile(changed, auth, [])).toMatchObject({
        kind: "blocked",
        code: "invalid-authorization",
      });
    }
  });

  it("rejects stale, future, and wrong-environment trusted authorization", () => {
    const auth = authorization();
    expect(compile(auth, auth, [], auth.expiresAt)).toMatchObject({
      kind: "blocked",
      code: "stale-authorization",
    });
    expect(compile(auth, auth, [], auth.issuedAt - 1)).toMatchObject({
      kind: "blocked",
      code: "stale-authorization",
    });
    const staging = authorization({ environment: "staging" });
    expect(compile(auth, staging, [])).toMatchObject({
      kind: "blocked",
      code: "authorization-mismatch",
    });
  });

  it("rejects missing bindings, duplicate runs, and reordered runs", () => {
    const auth = authorization();
    const first = run(digest("1"), "active");
    const second = run(digest("2"), "restartable");
    expect(
      compile(auth, auth, [{ ...first, completionBindingHash: "missing" }]),
    ).toMatchObject({ kind: "blocked", code: "invalid-runs" });
    expect(compile(auth, auth, [first, first])).toMatchObject({
      kind: "blocked",
      code: "invalid-runs",
    });
    expect(compile(auth, auth, [second, first])).toMatchObject({
      kind: "blocked",
      code: "invalid-runs",
    });
  });

  it("uses one injected clock and does not mutate authorization or runs", () => {
    const auth = authorization();
    const runs = [run(digest("1"), "active")];
    const before = structuredClone({ auth, runs });
    let reads = 0;
    const result = compileAuthorizedWorkflowCensus(
      { authorization: auth, expectedAuthorization: auth, runs },
      {
        nowMs: () => {
          reads += 1;
          return now + 1;
        },
      },
    );
    expect(result.kind).toBe("compiled");
    expect(reads).toBe(1);
    expect({ auth, runs }).toEqual(before);
  });
});
