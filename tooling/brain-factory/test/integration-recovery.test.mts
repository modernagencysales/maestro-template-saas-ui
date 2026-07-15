import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  acquireIntegrationOwnership,
  persistLegacyIntegrationRecovery,
  planLegacyIntegrationRecovery,
  repairWorkflowArgs,
} from "../src/integration-recovery.js";

const roots: string[] = [];
const root = (): string => {
  const value = mkdtempSync(resolve(tmpdir(), "brain-integration-recovery-"));
  roots.push(value);
  return value;
};

afterEach(() => {
  for (const value of roots.splice(0)) {
    rmSync(value, { force: true, recursive: true });
  }
});

const validInput = () => {
  const fixtureRoot = root();
  const worktreePath = resolve(fixtureRoot, "integration-F0-foundation");
  return {
    branchHead: "integration-head",
    controlHead: "control-head",
    failedRun: {
      run_id: "failed-run",
      run_spec: {
        settings: {
          run: {
            inputs: {
              base_sha: "base",
              tranche: "F0-foundation",
              workdir: worktreePath,
            },
            metadata: { tranche: "F0-foundation" },
          },
        },
      },
      status: { kind: "failed" },
    },
    integrationResult: {
      broadGate: { headSha: "wrong", status: "passed" },
      includedTasks: [{ taskHeadSha: "lane-head", taskId: "S00-T02" }],
      reviewVerdict: "pass",
      schemaVersion: "maestro-brain-integration-result/v1",
      status: "passed",
    },
    isAncestor: (ancestor: string, descendant: string) =>
      (ancestor === "base" && descendant === "integration-head") ||
      (ancestor === "integration-head" && descendant === "control-head"),
    now: "2026-07-15T00:00:00.000Z",
    reason: "legacy run failed its full gate",
    runRecord: {
      baseSha: "base",
      branch: "fabro/brain-f0-foundation",
      runId: "failed-run",
      tranche: "F0-foundation",
      workdir: worktreePath,
    },
    tranche: "F0-foundation",
    worktreeClean: true,
    worktreeHead: "integration-head",
    worktreePath,
  } as const;
};

describe("legacy integration recovery", () => {
  it("normalizes a verified failed legacy attempt to explicit rework", () => {
    const plan = planLegacyIntegrationRecovery(validInput());
    expect(plan.normalizedResult).toMatchObject({
      baseSha: "base",
      headSha: "integration-head",
      integrationId: "F0-foundation",
      integrationWorkdir: expect.stringContaining("integration-F0-foundation"),
      manifestTranche: "F0-foundation",
      requiredFindingIds: ["legacy-integration-run-failed"],
      reviewVerdict: "rework",
      sourceRunStatus: "failed",
      sourceReviewRun: "failed-run",
      status: "rework",
      tranche: "F0-foundation",
    });
    expect(plan.normalizedResult).not.toHaveProperty("broadGate");
    expect(plan.normalizedResult.includedTasks).toEqual([
      expect.objectContaining({ laneHeadSha: "lane-head", taskId: "S00-T02" }),
    ]);
    expect(plan.auditEvent).toMatchObject({
      action: "recover-legacy-integration",
      reason: "legacy run failed its full gate",
      sourceRunStatus: "failed",
      sourceReviewRun: "failed-run",
    });

    const inputWithFinding = validInput();
    const planWithFinding = planLegacyIntegrationRecovery({
      ...inputWithFinding,
      integrationResult: {
        ...(inputWithFinding.integrationResult as Record<string, unknown>),
        remainingFindings: [{ id: "existing-risk", severity: "high" }],
      },
    });
    expect(planWithFinding.normalizedResult.requiredFindingIds).toEqual([
      "existing-risk",
      "legacy-integration-run-failed",
    ]);
  });

  it("fails closed on unverified run, dirty worktree, or ancestry drift", () => {
    const input = validInput();
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        failedRun: { ...input.failedRun, status: { kind: "running" } },
      }),
    ).toThrow("only a verified failed run may be recovered");
    expect(() =>
      planLegacyIntegrationRecovery({ ...validInput(), worktreeClean: false }),
    ).toThrow("integration worktree is not clean");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...validInput(),
        isAncestor: () => false,
      }),
    ).toThrow("integration base is not an ancestor");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...validInput(),
        isAncestor: (ancestor, descendant) =>
          ancestor === "base" && descendant === "integration-head",
      }),
    ).toThrow("integration head is not an ancestor of control HEAD");
  });

  it("binds the failed Fabro run to the exact recorded attempt", () => {
    const input = validInput();
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        failedRun: { ...input.failedRun, run_id: "another-failed-run" },
      }),
    ).toThrow("Fabro run ID does not match run record");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        failedRun: {
          ...input.failedRun,
          run_spec: {
            settings: {
              run: {
                inputs: {
                  base_sha: "another-base",
                  tranche: "F0-foundation",
                  workdir: input.worktreePath,
                },
                metadata: { tranche: "F0-foundation" },
              },
            },
          },
        },
      }),
    ).toThrow("Fabro run base mismatch");
  });

  it("rejects missing reason, ownership drift, and already-versioned evidence", () => {
    expect(() =>
      planLegacyIntegrationRecovery({ ...validInput(), reason: " " }),
    ).toThrow("recovery reason must be a non-empty string");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...validInput(),
        branchHead: "different-head",
      }),
    ).toThrow("branch and worktree heads differ");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...validInput(),
        integrationResult: {
          baseSha: "base",
          headSha: "integration-head",
          includedTasks: [{ laneHeadSha: "lane-head", taskId: "S00-T02" }],
          integrationId: "F0-foundation",
          integrationWorkdir: validInput().worktreePath,
          manifestTranche: "F0-foundation",
        },
      }),
    ).toThrow("integration evidence is already versioned");
  });

  it("requires the run record to own the exact integration identity", () => {
    const input = validInput();
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        runRecord: {
          ...input.runRecord,
          integrationId: "F0-foundation-w2",
        },
      }),
    ).toThrow("run record integration ID mismatch");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        runRecord: {
          ...input.runRecord,
          manifestTranche: "C1-core",
        },
      }),
    ).toThrow("run record manifest tranche mismatch");
  });

  it("stages the normalized result and appends the audited reason", () => {
    const fixtureRoot = root();
    const resultPath = resolve(
      fixtureRoot,
      "evidence",
      "integration",
      "F0-foundation",
      "integration-result.json",
    );
    const auditPath = resolve(fixtureRoot, "recovery-audit.jsonl");
    mkdirSync(resolve(resultPath, ".."), { recursive: true });
    const plan = planLegacyIntegrationRecovery(validInput());
    persistLegacyIntegrationRecovery({ auditPath, plan, resultPath });
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toMatchObject({
      reviewVerdict: "rework",
      status: "rework",
    });
    expect(readFileSync(auditPath, "utf8")).toContain(
      "legacy run failed its full gate",
    );
    expect(existsSync(`${resultPath}.next`)).toBe(false);
  });

  it("uses exclusive tranche ownership and exact repair workflow inputs", () => {
    const fixtureRoot = root();
    const lockPath = resolve(fixtureRoot, "F0.lock");
    const release = acquireIntegrationOwnership({
      lockPath,
      owner: { pid: 1 },
    });
    expect(() =>
      acquireIntegrationOwnership({ lockPath, owner: { pid: 2 } }),
    ).toThrow("integration ownership already exists");
    release();
    expect(
      repairWorkflowArgs({
        controlRoot: "/control",
        evidenceDirectory: "/evidence",
        repairBaseSha: "integration-head",
        sourceReviewRun: "failed-run",
        tranche: "F0-foundation",
        workdir: "/workdir",
        workflow: "/workflow.fabro",
      }),
    ).toEqual(
      expect.arrayContaining([
        "fabro",
        "run",
        "/workflow.fabro",
        "source_review_run=failed-run",
        "base_sha=integration-head",
        "tranche=F0-foundation",
      ]),
    );
  });
});
