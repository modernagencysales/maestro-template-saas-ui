import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  acquireIntegrationOwnership,
  integrationLockPath,
  persistLegacyIntegrationRecovery,
  planLegacyIntegrationRecovery,
  promoteRepairLaunch,
  reconcileDurableRepairLaunch,
  reconcileLegacyIntegrationRecovery,
  repairWorkflowArgs,
  reserveRepairLaunch,
  safeAbsolutePath,
} from "../src/integration-recovery.js";

const BASE_SHA = "1".repeat(40);
const HEAD_SHA = "2".repeat(40);
const CONTROL_SHA = "3".repeat(40);
const LANE_SHA = "4".repeat(40);
const INTEGRATION_COMMIT_SHA = "5".repeat(40);
const SOURCE_RUN_ID = "01KXHDXG8A8751TZ3HY4CQJKBD";
const REPAIR_RUN_ID = "01KXHE00000000000000000000";
const RESERVATION_TOKEN = "12345678-1234-4123-8123-123456789abc";

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
    branchHead: HEAD_SHA,
    controlHead: CONTROL_SHA,
    failedRun: {
      run_id: SOURCE_RUN_ID,
      run_spec: {
        settings: {
          run: {
            inputs: {
              base_sha: BASE_SHA,
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
      baseHeadSha: BASE_SHA,
      broadGate: { headSha: "wrong", status: "passed" },
      commits: [
        {
          integrationCommitSha: INTEGRATION_COMMIT_SHA,
          sourceCommitSha: LANE_SHA,
          taskId: "S00-T02",
        },
      ],
      includedTasks: [
        {
          integrationCommitSha: INTEGRATION_COMMIT_SHA,
          taskHeadSha: LANE_SHA,
          taskId: "S00-T02",
          tranche: "F0-foundation",
        },
      ],
      integrationHeadSha: HEAD_SHA,
      reviewVerdict: "pass",
      schemaVersion: "maestro-brain-integration-result/v1",
      status: "passed",
      tranche: "F0-foundation",
      worktree: worktreePath,
    },
    isAncestor: (ancestor: string, descendant: string) =>
      (ancestor === BASE_SHA && descendant === HEAD_SHA) ||
      (ancestor === HEAD_SHA && descendant === CONTROL_SHA) ||
      (ancestor === INTEGRATION_COMMIT_SHA && descendant === HEAD_SHA),
    manifestTaskIds: ["S00-T01", "S00-T02", "S00-T03", "S00-T04"],
    now: "2026-07-15T00:00:00.000Z",
    reason: "legacy run failed its full gate",
    runRecord: {
      baseSha: BASE_SHA,
      branch: "fabro/brain-f0-foundation",
      runId: SOURCE_RUN_ID,
      tranche: "F0-foundation",
      workdir: worktreePath,
    },
    tranche: "F0-foundation",
    worktreeClean: true,
    worktreeHead: HEAD_SHA,
    worktreePath,
  } as const;
};

describe("legacy integration recovery", () => {
  it("normalizes a verified failed legacy attempt to explicit rework", () => {
    const plan = planLegacyIntegrationRecovery(validInput());
    expect(plan.normalizedResult).toMatchObject({
      baseSha: BASE_SHA,
      headSha: HEAD_SHA,
      integrationId: "F0-foundation",
      integrationWorkdir: expect.stringContaining("integration-F0-foundation"),
      manifestTranche: "F0-foundation",
      reviewVerdict: "rework",
      sourceRunStatus: "failed",
      sourceReviewRun: SOURCE_RUN_ID,
      status: "rework",
      tranche: "F0-foundation",
    });
    expect(plan.normalizedResult).not.toHaveProperty("broadGate");
    expect(plan.normalizedResult.includedTasks).toEqual([
      expect.objectContaining({ laneHeadSha: LANE_SHA, taskId: "S00-T02" }),
    ]);
    expect(plan.auditEvent).toMatchObject({
      action: "recover-legacy-integration",
      reason: "legacy run failed its full gate",
      sourceRunStatus: "failed",
      sourceReviewRun: SOURCE_RUN_ID,
    });

    const inputWithFinding = validInput();
    const planWithFinding = planLegacyIntegrationRecovery({
      ...inputWithFinding,
      integrationResult: {
        ...(inputWithFinding.integrationResult as Record<string, unknown>),
        remainingFindings: [{ id: "existing-risk", severity: "high" }],
        requiredFindingIds: [],
        resolvedFindings: [{ id: "legacy-integration-run-failed" }],
      },
    });
    expect(planWithFinding.normalizedResult).not.toHaveProperty(
      "requiredFindingIds",
    );
    expect(planWithFinding.normalizedResult.resolvedFindings).toEqual([]);
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
          (ancestor === BASE_SHA && descendant === HEAD_SHA) ||
          (ancestor === INTEGRATION_COMMIT_SHA && descendant === HEAD_SHA),
      }),
    ).toThrow("integration head is not an ancestor of control HEAD");
  });

  it("binds the failed Fabro run to the exact recorded attempt", () => {
    const input = validInput();
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        failedRun: { ...input.failedRun, run_id: REPAIR_RUN_ID },
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
                  base_sha: "a".repeat(40),
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

  it("rejects missing reason, ownership drift, and drifted recovery", () => {
    expect(() =>
      planLegacyIntegrationRecovery({ ...validInput(), reason: " " }),
    ).toThrow("recovery reason must be a non-empty string");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...validInput(),
        branchHead: "a".repeat(40),
      }),
    ).toThrow("branch and worktree heads differ");
    const input = validInput();
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        integrationResult: {
          ...input.integrationResult,
          recovery: { sourceReviewRun: SOURCE_RUN_ID },
        },
      }),
    ).toThrow("normalized recovery evidence drifted");
  });

  it("reconstructs the same plan from normalized recovery evidence", () => {
    const input = validInput();
    const original = planLegacyIntegrationRecovery(input);
    const resumed = planLegacyIntegrationRecovery({
      ...input,
      integrationResult: original.normalizedResult,
    });
    expect(resumed).toEqual(original);
  });

  it("binds legacy evidence to its schema, tranche, heads, and worktree", () => {
    const input = validInput();
    for (const [field, value, message] of [
      ["schemaVersion", "other/v1", "unexpected legacy evidence schema"],
      ["tranche", "C1-contract-spine", "legacy evidence tranche mismatch"],
      ["baseHeadSha", "a".repeat(40), "legacy evidence base mismatch"],
      ["integrationHeadSha", BASE_SHA, "legacy evidence head mismatch"],
      ["integrationHeadSha", CONTROL_SHA, "legacy evidence head mismatch"],
      [
        "worktree",
        resolve(root(), "swapped"),
        "legacy evidence worktree mismatch",
      ],
    ] as const) {
      expect(() =>
        planLegacyIntegrationRecovery({
          ...input,
          integrationResult: { ...input.integrationResult, [field]: value },
        }),
      ).toThrow(message);
    }
  });

  it("rejects swapped tasks and integration commits outside the current head", () => {
    const input = validInput();
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        integrationResult: {
          ...input.integrationResult,
          includedTasks: [
            {
              integrationCommitSha: INTEGRATION_COMMIT_SHA,
              taskHeadSha: LANE_SHA,
              taskId: "S01-T01",
              tranche: "C1-contract-spine",
            },
          ],
        },
      }),
    ).toThrow("task is outside manifest tranche");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        integrationResult: {
          ...input.integrationResult,
          includedTasks: [
            {
              integrationCommitSha: CONTROL_SHA,
              taskHeadSha: LANE_SHA,
              taskId: "S00-T02",
              tranche: "F0-foundation",
            },
          ],
        },
      }),
    ).toThrow("integration commit is not on the integration head");
  });

  it("rejects malformed or option-like run IDs and SHAs", () => {
    const input = validInput();
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        runRecord: { ...input.runRecord, runId: "--help" },
      }),
    ).toThrow("run record runId must be a ULID");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        runRecord: { ...input.runRecord, baseSha: "--help" },
      }),
    ).toThrow("run record baseSha must be a 40-character Git SHA");
    expect(() =>
      planLegacyIntegrationRecovery({
        ...input,
        integrationResult: {
          ...input.integrationResult,
          commits: [
            {
              integrationCommitSha: "--help",
              sourceCommitSha: LANE_SHA,
              taskId: "S00-T02",
            },
          ],
        },
      }),
    ).toThrow(
      "S00-T02 commit integrationCommitSha must be a 40-character Git SHA",
    );
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
    writeFileSync(auditPath, '{"action":"older-recovery"}\n');
    const plan = planLegacyIntegrationRecovery(validInput());
    persistLegacyIntegrationRecovery({ auditPath, plan, resultPath });
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toMatchObject({
      reviewVerdict: "rework",
      status: "rework",
    });
    const audit = readFileSync(auditPath, "utf8");
    expect(audit).toContain("older-recovery");
    expect(audit).toContain("legacy run failed its full gate");
    expect(existsSync(`${resultPath}.next`)).toBe(false);

    writeFileSync(`${resultPath}.next`, "crash residue\n");
    expect(() =>
      persistLegacyIntegrationRecovery({ auditPath, plan, resultPath }),
    ).toThrow("recovery staging file conflicts");
    expect(readFileSync(auditPath, "utf8")).toBe(audit);
  });

  it("uses a checkout-global, token-verified integration lock", () => {
    const fixtureRoot = root();
    const gitCommonDirectory = resolve(fixtureRoot, ".git");
    const lockPath = integrationLockPath(gitCommonDirectory, "F0-foundation");
    expect(lockPath).toBe(
      resolve(
        fixtureRoot,
        ".git",
        "maestro-brain-factory",
        "integration-F0-foundation.lock",
      ),
    );
    expect(lockPath).not.toContain(".fabro/state");
    const release = acquireIntegrationOwnership({
      lockPath,
      owner: { pid: 1 },
    });
    expect(() =>
      acquireIntegrationOwnership({ lockPath, owner: { pid: 2 } }),
    ).toThrow("integration ownership already exists");
    const ownerPath = resolve(lockPath, "owner.json");
    const originalOwner = readFileSync(ownerPath, "utf8");
    writeFileSync(ownerPath, originalOwner.replace('"pid": 1', '"pid": 2'));
    expect(release).toThrow("integration ownership changed");
    expect(existsSync(lockPath)).toBe(true);
  });

  it("releases only the unchanged lock it acquired", () => {
    const lockPath = integrationLockPath(
      resolve(root(), ".git"),
      "F0-foundation",
    );
    const release = acquireIntegrationOwnership({
      lockPath,
      owner: { pid: 1 },
    });
    release();
    expect(existsSync(lockPath)).toBe(false);
  });

  it("does not let a stale releaser delete a replacement owner", () => {
    const lockPath = integrationLockPath(
      resolve(root(), ".git"),
      "F0-foundation",
    );
    const staleRelease = acquireIntegrationOwnership({
      lockPath,
      owner: { pid: 1 },
    });
    rmSync(lockPath, { recursive: true });
    const currentRelease = acquireIntegrationOwnership({
      lockPath,
      owner: { pid: 2 },
    });
    expect(staleRelease).toThrow("integration ownership changed");
    expect(existsSync(lockPath)).toBe(true);
    currentRelease();
  });

  it("reserves and promotes a repair launch without overwriting crash state", () => {
    const repairPath = resolve(root(), "runs", "repair-F0-foundation.json");
    const token = reserveRepairLaunch(repairPath, {
      sourceReviewRun: SOURCE_RUN_ID,
      status: "preparing",
    });
    const reserved = readFileSync(repairPath, "utf8");
    expect(() =>
      reserveRepairLaunch(repairPath, {
        sourceReviewRun: SOURCE_RUN_ID,
        status: "preparing",
      }),
    ).toThrow("repair launch reservation already exists");
    expect(readFileSync(repairPath, "utf8")).toBe(reserved);
    expect(() =>
      promoteRepairLaunch(repairPath, "wrong-token", {
        runId: REPAIR_RUN_ID,
        status: "launched",
      }),
    ).toThrow("repair launch reservation changed");
    writeFileSync(`${repairPath}.next`, "crash residue\n");
    expect(() =>
      promoteRepairLaunch(repairPath, token, {
        runId: REPAIR_RUN_ID,
        status: "launched",
      }),
    ).toThrow("repair launch staging file conflicts");
    expect(readFileSync(repairPath, "utf8")).toBe(reserved);
    rmSync(`${repairPath}.next`);
    promoteRepairLaunch(repairPath, token, {
      runId: REPAIR_RUN_ID,
      status: "launched",
    });
    expect(JSON.parse(readFileSync(repairPath, "utf8"))).toMatchObject({
      runId: REPAIR_RUN_ID,
      status: "launched",
    });
  });

  it.each([
    "after-reservation",
    "after-audit-append",
    "after-normalization",
    "after-launch",
    "after-promotion-stage",
  ] as const)("resumes idempotently after %s", (faultPoint) => {
    const fixtureRoot = root();
    const resultPath = resolve(fixtureRoot, "integration-result.json");
    const auditPath = resolve(fixtureRoot, "recovery-audit.jsonl");
    const repairRecordPath = resolve(fixtureRoot, "repair-F0-foundation.json");
    const authority = validInput();
    const plan = planLegacyIntegrationRecovery(authority);
    writeFileSync(
      resultPath,
      `${JSON.stringify(authority.integrationResult, null, 2)}\n`,
    );
    const liveRuns = new Map<number, string>();
    let launchCalls = 0;
    const run = (fault?: typeof faultPoint) =>
      reconcileLegacyIntegrationRecovery({
        auditPath,
        discoverLaunchedRun: ({ attempt }) => liveRuns.get(attempt),
        ...(fault
          ? {
              fault: (point) => {
                if (point === fault) throw new Error(`crash:${point}`);
              },
            }
          : {}),
        identity: {
          baseSha: plan.repairBaseSha,
          sourceReviewRun: plan.sourceReviewRun,
          tranche: authority.tranche,
          workdir: authority.worktreePath,
        },
        launch: ({ attempt }) => {
          launchCalls += 1;
          liveRuns.set(attempt, REPAIR_RUN_ID);
          return REPAIR_RUN_ID;
        },
        plan,
        repairRecordPath,
        resultPath,
      });

    expect(() => run(faultPoint)).toThrow(`crash:${faultPoint}`);
    const durableResult = JSON.parse(readFileSync(resultPath, "utf8")) as {
      readonly recovery?: unknown;
    };
    const durableReservation = JSON.parse(
      readFileSync(repairRecordPath, "utf8"),
    ) as { readonly status?: unknown };
    if (faultPoint === "after-reservation") {
      expect(existsSync(auditPath)).toBe(false);
      expect(durableResult.recovery).toBeUndefined();
    }
    if (faultPoint === "after-audit-append") {
      expect(durableResult.recovery).toBeUndefined();
      expect(existsSync(`${resultPath}.next`)).toBe(true);
    }
    if (faultPoint === "after-normalization") {
      expect(durableResult.recovery).toBeDefined();
      expect(launchCalls).toBe(0);
    }
    if (faultPoint === "after-launch") {
      expect(durableReservation.status).toBe("preparing");
      expect(liveRuns.size).toBe(1);
    }
    if (faultPoint === "after-promotion-stage") {
      expect(durableReservation.status).toBe("preparing");
      expect(existsSync(`${repairRecordPath}.next`)).toBe(true);
    }
    expect(run()).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
    expect(run()).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
    expect(launchCalls).toBe(1);
    expect(
      readFileSync(auditPath, "utf8").split("\n").filter(Boolean),
    ).toHaveLength(1);
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual(
      plan.normalizedResult,
    );
    expect(JSON.parse(readFileSync(repairRecordPath, "utf8"))).toMatchObject({
      runId: REPAIR_RUN_ID,
      status: "launched",
    });
  });

  it("records a launch failure and retries a new attempt exactly once", () => {
    const fixtureRoot = root();
    const resultPath = resolve(fixtureRoot, "integration-result.json");
    const auditPath = resolve(fixtureRoot, "recovery-audit.jsonl");
    const repairRecordPath = resolve(fixtureRoot, "repair-F0-foundation.json");
    const authority = validInput();
    const plan = planLegacyIntegrationRecovery(authority);
    writeFileSync(
      resultPath,
      `${JSON.stringify(authority.integrationResult, null, 2)}\n`,
    );
    let launchCalls = 0;
    const liveRuns = new Map<number, string>();
    const run = () =>
      reconcileLegacyIntegrationRecovery({
        auditPath,
        discoverLaunchedRun: ({ attempt }) => liveRuns.get(attempt),
        identity: {
          baseSha: plan.repairBaseSha,
          sourceReviewRun: plan.sourceReviewRun,
          tranche: authority.tranche,
          workdir: authority.worktreePath,
        },
        launch: ({ attempt }) => {
          launchCalls += 1;
          if (launchCalls === 1) throw new Error("definite launch failure");
          liveRuns.set(attempt, REPAIR_RUN_ID);
          return REPAIR_RUN_ID;
        },
        plan,
        repairRecordPath,
        resultPath,
      });
    expect(run).toThrow("definite launch failure");
    expect(JSON.parse(readFileSync(repairRecordPath, "utf8"))).toMatchObject({
      launchAttempt: 1,
      status: "launch_failed",
    });
    expect(run()).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
    expect(run()).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
    expect(launchCalls).toBe(2);
    expect(liveRuns.size).toBe(1);
    expect(
      readFileSync(auditPath, "utf8").split("\n").filter(Boolean),
    ).toHaveLength(1);
  });

  it("promotes a durable live-run receipt without rereading mutable evidence", () => {
    const repairRecordPath = resolve(root(), "repair-F0-foundation.json");
    reserveRepairLaunch(repairRecordPath, {
      baseSha: HEAD_SHA,
      launchAttempt: 1,
      schemaVersion: "maestro-brain-repair-reservation/v1",
      sourceReviewRun: SOURCE_RUN_ID,
      status: "preparing",
      tranche: "F0-foundation",
      workdir: "/workdir",
    });
    expect(
      reconcileDurableRepairLaunch({
        discoverLaunchedRun: () => REPAIR_RUN_ID,
        repairRecordPath,
      }),
    ).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
    expect(
      reconcileDurableRepairLaunch({
        discoverLaunchedRun: () => {
          throw new Error("must not rediscover an already promoted run");
        },
        repairRecordPath,
      }),
    ).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
  });

  it("uses exact repair workflow inputs and rejects shell-hostile values", () => {
    expect(
      repairWorkflowArgs({
        controlRoot: "/control",
        evidenceDirectory: "/evidence",
        launchAttempt: 1,
        recoveryAuditPath: "/state/recovery-audit.jsonl",
        repairBaseSha: HEAD_SHA,
        reservationToken: RESERVATION_TOKEN,
        sourceReviewRun: SOURCE_RUN_ID,
        tranche: "F0-foundation",
        workdir: "/workdir",
        workflow: "/workflow.fabro",
      }),
    ).toEqual(
      expect.arrayContaining([
        "fabro",
        "run",
        "/workflow.fabro",
        "recovery_audit=/state/recovery-audit.jsonl",
        `source_review_run=${SOURCE_RUN_ID}`,
        `base_sha=${HEAD_SHA}`,
        "tranche=F0-foundation",
      ]),
    );
    const base = {
      controlRoot: "/control",
      evidenceDirectory: "/evidence",
      launchAttempt: 1,
      recoveryAuditPath: "/state/recovery-audit.jsonl",
      repairBaseSha: HEAD_SHA,
      reservationToken: RESERVATION_TOKEN,
      sourceReviewRun: SOURCE_RUN_ID,
      tranche: "F0-foundation",
      workdir: "/workdir",
      workflow: "/workflow.fabro",
    } as const;
    for (const hostile of [
      "/tmp/'quoted",
      "/tmp/$(touch pwned)",
      "/tmp/a\nb",
    ]) {
      expect(() =>
        repairWorkflowArgs({ ...base, controlRoot: hostile }),
      ).toThrow("controlRoot contains shell-unsafe characters");
    }
    expect(() =>
      repairWorkflowArgs({ ...base, sourceReviewRun: "--help" }),
    ).toThrow("sourceReviewRun must be a ULID");
    expect(() =>
      repairWorkflowArgs({ ...base, repairBaseSha: "--help" }),
    ).toThrow("repairBaseSha must be a 40-character Git SHA");
    expect(() => safeAbsolutePath("/tmp/state\n--help", "state path")).toThrow(
      "state path contains shell-unsafe characters",
    );
  });
});
