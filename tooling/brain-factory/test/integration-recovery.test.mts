import { createHash } from "node:crypto";
import {
  chmodSync,
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
  buildRepairCreateReceipt,
  buildRepairLaunchReceipt,
  discoverCreatedRepairRun,
  dispatchIntegrationRecovery,
  inspectRepairRunPhase,
  integrationLockPath,
  persistLegacyIntegrationRecovery,
  planLegacyIntegrationRecovery,
  promoteRepairLaunch,
  reconcileDurableRepairLaunch,
  reconcileLegacyIntegrationRecovery,
  repairWorkflowCreateArgs,
  repairWorkflowStartArgs,
  reserveRepairLaunch,
  safeAbsolutePath,
  verifyRepairLaunchInspection,
  type RepairLaunchReceiptInput,
} from "../src/integration-recovery.js";
import { runRtkToFile } from "../src/process.js";

const BASE_SHA = "1".repeat(40);
const HEAD_SHA = "2".repeat(40);
const CONTROL_SHA = "3".repeat(40);
const LANE_SHA = "4".repeat(40);
const INTEGRATION_COMMIT_SHA = "5".repeat(40);
const SOURCE_RUN_ID = "01KXHDXG8A8751TZ3HY4CQJKBD";
const REPAIR_RUN_ID = "01KXHE00000000000000000000";
const RESERVATION_TOKEN = "12345678-1234-4123-8123-123456789abc";

type LaunchIdentity = Omit<RepairLaunchReceiptInput, "runId">;
const foundCreatedRun = (identity: LaunchIdentity, runId = REPAIR_RUN_ID) => ({
  kind: "found" as const,
  receipt: buildRepairCreateReceipt({ ...identity, runId }),
});
const repairInspection = (
  identity: LaunchIdentity,
  input: {
    readonly reservationToken?: string;
    readonly runId?: string;
    readonly status?: string;
  } = {},
) => [
  {
    run_id: input.runId ?? REPAIR_RUN_ID,
    run_spec: {
      graph: { name: "BrainRepairTranche" },
      settings: {
        run: {
          inputs: {
            base_sha: identity.baseSha,
            source_review_run: identity.sourceReviewRun,
            tranche: identity.tranche,
            workdir: identity.workdir,
          },
          metadata: {
            launch_attempt: String(identity.attempt),
            recovery_token: input.reservationToken ?? identity.reservationToken,
            tranche: identity.tranche,
          },
        },
      },
    },
    status: { kind: input.status ?? "created" },
  },
];
const writeNonzeroLaunchOutcome = (
  rawPath: string,
  outcomePath: string,
): void => {
  const output = "partial";
  writeFileSync(rawPath, output);
  writeFileSync(
    outcomePath,
    `${JSON.stringify({
      kind: "exited",
      outputPath: resolve(rawPath),
      outputSha256: createHash("sha256").update(output).digest("hex"),
      schemaVersion: "maestro-rtk-file-outcome/v1",
      status: 1,
    })}\n`,
  );
};

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

const durableFixture = () => {
  const authority = validInput();
  const fixtureRoot = resolve(authority.worktreePath, "..");
  const plan = planLegacyIntegrationRecovery(authority);
  const resultPath = resolve(fixtureRoot, "durable-integration-result.json");
  const auditPath = resolve(fixtureRoot, "durable-recovery-audit.jsonl");
  const repairRecordPath = resolve(fixtureRoot, "durable-repair.json");
  writeFileSync(resultPath, `${JSON.stringify(plan.normalizedResult)}\n`);
  writeFileSync(auditPath, `${JSON.stringify(plan.auditEvent)}\n`);
  const reservationToken = reserveRepairLaunch(repairRecordPath, {
    baseSha: plan.repairBaseSha,
    integrationBaseSha: authority.runRecord.baseSha,
    launchAttempt: 1,
    recoveryAt: authority.now,
    recoveryReason: authority.reason,
    schemaVersion: "maestro-brain-repair-reservation/v1",
    sourceReviewRun: authority.runRecord.runId,
    startAttempt: 0,
    status: "preparing",
    taskIds: ["S00-T02"],
    tranche: authority.tranche,
    transitionHash: "a".repeat(64),
    workdir: authority.worktreePath,
  });
  return {
    auditPath,
    authority,
    expected: {
      baseSha: plan.repairBaseSha,
      integrationBaseSha: authority.runRecord.baseSha,
      sourceReviewRun: authority.runRecord.runId,
      tranche: authority.tranche,
      workdir: authority.worktreePath,
    },
    manifestTaskIds: authority.manifestTaskIds,
    plan,
    repairRecordPath,
    reservationToken,
    resultPath,
  } as const;
};

const createdDurableFixture = () => {
  const fixture = durableFixture();
  const identity: LaunchIdentity = {
    attempt: 1,
    baseSha: fixture.expected.baseSha,
    integrationBaseSha: fixture.expected.integrationBaseSha,
    reservationToken: fixture.reservationToken,
    sourceReviewRun: fixture.expected.sourceReviewRun,
    taskIds: ["S00-T02"],
    tranche: fixture.expected.tranche,
    workdir: fixture.expected.workdir,
  };
  const reservation = JSON.parse(
    readFileSync(fixture.repairRecordPath, "utf8"),
  ) as Record<string, unknown>;
  writeFileSync(
    fixture.repairRecordPath,
    `${JSON.stringify(
      {
        ...reservation,
        createReceipt: buildRepairCreateReceipt({
          ...identity,
          runId: REPAIR_RUN_ID,
        }),
        createdRunId: REPAIR_RUN_ID,
        status: "created",
      },
      null,
      2,
    )}\n`,
  );
  return { ...fixture, identity } as const;
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
    "after-recovery-stage",
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
    const createdRuns = new Set<number>();
    const startedRuns = new Set<number>();
    let createCalls = 0;
    const run = (fault?: typeof faultPoint, candidatePlan = plan) =>
      reconcileLegacyIntegrationRecovery({
        auditPath,
        create: (launchIdentity) => {
          createCalls += 1;
          createdRuns.add(launchIdentity.attempt);
          return foundCreatedRun(launchIdentity).receipt;
        },
        discoverCreatedRun: (launchIdentity) =>
          createdRuns.has(launchIdentity.attempt)
            ? foundCreatedRun(launchIdentity)
            : { kind: "absent" },
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
        inspectRun: (launchIdentity) =>
          startedRuns.has(launchIdentity.attempt) ? "accepted" : "startable",
        plan: candidatePlan,
        repairRecordPath,
        resultPath,
        start: (launchIdentity) => {
          startedRuns.add(launchIdentity.attempt);
        },
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
    if (faultPoint === "after-recovery-stage") {
      expect(existsSync(auditPath)).toBe(false);
      expect(durableResult.recovery).toBeUndefined();
      expect(existsSync(`${resultPath}.next`)).toBe(true);
    }
    if (faultPoint === "after-normalization") {
      expect(durableResult.recovery).toBeDefined();
      expect(createCalls).toBe(0);
    }
    if (faultPoint === "after-launch") {
      expect(durableReservation.status).toBe("starting");
      expect(createdRuns.size).toBe(1);
    }
    if (faultPoint === "after-promotion-stage") {
      expect(durableReservation.status).toBe("starting");
      expect(existsSync(`${repairRecordPath}.next`)).toBe(true);
    }
    const freshPlan = planLegacyIntegrationRecovery({
      ...authority,
      now: "2026-07-15T00:00:01.000Z",
    });
    expect(run(undefined, freshPlan)).toEqual({
      runId: REPAIR_RUN_ID,
      status: "launched",
    });
    expect(run(undefined, freshPlan)).toEqual({
      runId: REPAIR_RUN_ID,
      status: "launched",
    });
    expect(createCalls).toBe(1);
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

  it.each([
    "after-reservation",
    "after-recovery-stage",
    "after-audit-append",
  ] as const)(
    "routes pre-normalization %s residue through canonical reconstruction",
    (faultPoint) => {
      const authority = validInput();
      const fixtureRoot = resolve(authority.worktreePath, "..");
      const resultPath = resolve(fixtureRoot, `dispatch-${faultPoint}.json`);
      const auditPath = resolve(fixtureRoot, `dispatch-${faultPoint}.jsonl`);
      const repairRecordPath = resolve(
        fixtureRoot,
        `dispatch-${faultPoint}-repair.json`,
      );
      const originalPlan = planLegacyIntegrationRecovery(authority);
      writeFileSync(
        resultPath,
        `${JSON.stringify(authority.integrationResult)}\n`,
      );
      const createdAttempts = new Set<number>();
      const startedAttempts = new Set<number>();
      const reconcile = (
        plan: typeof originalPlan,
        fault?: typeof faultPoint,
      ) =>
        reconcileLegacyIntegrationRecovery({
          auditPath,
          create: (identity) => {
            createdAttempts.add(identity.attempt);
            return foundCreatedRun(identity).receipt;
          },
          discoverCreatedRun: (identity) =>
            createdAttempts.has(identity.attempt)
              ? foundCreatedRun(identity)
              : { kind: "absent" },
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
          inspectRun: (identity) =>
            startedAttempts.has(identity.attempt) ? "accepted" : "startable",
          plan,
          repairRecordPath,
          resultPath,
          start: (identity) => {
            startedAttempts.add(identity.attempt);
          },
        });

      expect(() => reconcile(originalPlan, faultPoint)).toThrow(
        `crash:${faultPoint}`,
      );
      const freshPlan = planLegacyIntegrationRecovery({
        ...authority,
        now: "2026-07-15T00:01:00.000Z",
      });
      let durableCalls = 0;
      expect(
        dispatchIntegrationRecovery({
          integrationResult: JSON.parse(readFileSync(resultPath, "utf8")),
          reconcileDurable: () => {
            durableCalls += 1;
            throw new Error(
              "pre-normalization state must not use durable path",
            );
          },
          reconcileFromEvidence: () => reconcile(freshPlan).runId,
          repairRecordExists: existsSync(repairRecordPath),
        }),
      ).toBe(REPAIR_RUN_ID);
      expect(durableCalls).toBe(0);
      expect(
        readFileSync(auditPath, "utf8").split("\n").filter(Boolean),
      ).toHaveLength(1);
      expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual(
        originalPlan.normalizedResult,
      );
    },
  );

  it("uses durable reconciliation only after normalized recovery exists", () => {
    const plan = planLegacyIntegrationRecovery(validInput());
    let durableCalls = 0;
    expect(
      dispatchIntegrationRecovery({
        integrationResult: plan.normalizedResult,
        reconcileDurable: () => {
          durableCalls += 1;
          return REPAIR_RUN_ID;
        },
        reconcileFromEvidence: () => {
          throw new Error("normalized recovery should use durable state");
        },
        repairRecordExists: true,
      }),
    ).toBe(REPAIR_RUN_ID);
    expect(durableCalls).toBe(1);
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
    let createCalls = 0;
    const createdRuns = new Set<number>();
    const startedRuns = new Set<number>();
    const run = () =>
      reconcileLegacyIntegrationRecovery({
        auditPath,
        create: (launchIdentity) => {
          createCalls += 1;
          if (createCalls === 1) throw new Error("definite create failure");
          createdRuns.add(launchIdentity.attempt);
          return foundCreatedRun(launchIdentity).receipt;
        },
        discoverCreatedRun: (launchIdentity) =>
          createdRuns.has(launchIdentity.attempt)
            ? foundCreatedRun(launchIdentity)
            : { kind: "absent" },
        identity: {
          baseSha: plan.repairBaseSha,
          sourceReviewRun: plan.sourceReviewRun,
          tranche: authority.tranche,
          workdir: authority.worktreePath,
        },
        inspectRun: (launchIdentity) =>
          startedRuns.has(launchIdentity.attempt) ? "accepted" : "startable",
        plan,
        repairRecordPath,
        resultPath,
        start: (launchIdentity) => {
          startedRuns.add(launchIdentity.attempt);
        },
      });
    expect(run).toThrow("definite create failure");
    expect(JSON.parse(readFileSync(repairRecordPath, "utf8"))).toMatchObject({
      launchAttempt: 1,
      status: "launch_failed",
    });
    expect(run()).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
    expect(run()).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
    expect(createCalls).toBe(2);
    expect(createdRuns.size).toBe(1);
    expect(
      readFileSync(auditPath, "utf8").split("\n").filter(Boolean),
    ).toHaveLength(1);
  });

  it("starts only the exact durable created run and promotes it", () => {
    const fixture = createdDurableFixture();
    let accepted = false;
    let startCalls = 0;
    const durableInput = {
      ...fixture,
      inspectRun: (identity: RepairLaunchReceiptInput) => {
        expect(identity.runId).toBe(REPAIR_RUN_ID);
        return accepted ? ("accepted" as const) : ("startable" as const);
      },
      start: (identity: RepairLaunchReceiptInput) => {
        startCalls += 1;
        expect(identity.runId).toBe(REPAIR_RUN_ID);
        expect(
          JSON.parse(readFileSync(fixture.repairRecordPath, "utf8")),
        ).toMatchObject({ createdRunId: REPAIR_RUN_ID, status: "starting" });
        accepted = true;
      },
    };
    expect(reconcileDurableRepairLaunch(durableInput)).toEqual({
      runId: REPAIR_RUN_ID,
      status: "launched",
    });
    expect(reconcileDurableRepairLaunch(durableInput)).toEqual({
      runId: REPAIR_RUN_ID,
      status: "launched",
    });
    expect(startCalls).toBe(1);
  });

  it.each(["reservationToken", "attempt", "taskIds", "receiptSha256"] as const)(
    "rejects a durable launch receipt with tampered %s",
    (field) => {
      const fixture = createdDurableFixture();
      expect(
        reconcileDurableRepairLaunch({
          ...fixture,
          inspectRun: () => "accepted",
          start: () => undefined,
        }),
      ).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
      const reservation = JSON.parse(
        readFileSync(fixture.repairRecordPath, "utf8"),
      ) as Record<string, unknown>;
      const receipt = buildRepairLaunchReceipt({
        ...fixture.identity,
        ...(field === "reservationToken"
          ? { reservationToken: "87654321-4321-4321-8321-cba987654321" }
          : {}),
        ...(field === "attempt" ? { attempt: 2 } : {}),
        ...(field === "taskIds" ? { taskIds: ["S00-T01"] } : {}),
        runId: REPAIR_RUN_ID,
      });
      if (field === "receiptSha256") receipt.receiptSha256 = "b".repeat(64);
      reservation.launchReceipt = receipt;
      writeFileSync(
        fixture.repairRecordPath,
        `${JSON.stringify(reservation, null, 2)}\n`,
      );
      expect(() =>
        reconcileDurableRepairLaunch({
          ...fixture,
          inspectRun: () => {
            throw new Error("tampered receipt must not reach inspection");
          },
          start: () => undefined,
        }),
      ).toThrow("receipt identity or digest mismatch");
    },
  );

  it("fails closed when exact created-run inspection is unavailable", () => {
    const fixture = createdDurableFixture();
    expect(() =>
      reconcileDurableRepairLaunch({
        ...fixture,
        inspectRun: () => {
          throw new Error("Fabro inspect failed");
        },
        start: () => {
          throw new Error("must not start without exact inspection");
        },
      }),
    ).toThrow("exact created-run inspection failed");
    expect(
      JSON.parse(readFileSync(fixture.repairRecordPath, "utf8")),
    ).toMatchObject({ createdRunId: REPAIR_RUN_ID, status: "created" });
  });

  it("checks Fabro workflow, labels, and inputs against the receipt identity", () => {
    const identity = {
      attempt: 1,
      baseSha: HEAD_SHA,
      integrationBaseSha: BASE_SHA,
      reservationToken: RESERVATION_TOKEN,
      runId: REPAIR_RUN_ID,
      sourceReviewRun: SOURCE_RUN_ID,
      taskIds: ["S00-T02"],
      tranche: "F0-foundation",
      workdir: "/workdir",
    } as const;
    const inspection = [
      {
        run_id: REPAIR_RUN_ID,
        run_spec: {
          graph: { name: "BrainRepairTranche" },
          settings: {
            run: {
              inputs: {
                base_sha: HEAD_SHA,
                source_review_run: SOURCE_RUN_ID,
                tranche: "F0-foundation",
                workdir: "/workdir",
              },
              metadata: {
                launch_attempt: "1",
                recovery_token: RESERVATION_TOKEN,
                tranche: "F0-foundation",
              },
            },
          },
        },
      },
    ];
    expect(() =>
      verifyRepairLaunchInspection(inspection, identity),
    ).not.toThrow();
    const swapped = structuredClone(inspection);
    const [swappedRun] = swapped;
    if (!swappedRun) throw new Error("missing inspection fixture");
    swappedRun.run_spec.settings.run.metadata.recovery_token =
      "87654321-4321-4321-8321-cba987654321";
    expect(() => verifyRepairLaunchInspection(swapped, identity)).toThrow(
      "labels or inputs do not match reservation",
    );
  });

  it("classifies exact created-run phases before deciding whether to start", () => {
    const identity = {
      attempt: 1,
      baseSha: HEAD_SHA,
      integrationBaseSha: BASE_SHA,
      reservationToken: RESERVATION_TOKEN,
      runId: REPAIR_RUN_ID,
      sourceReviewRun: SOURCE_RUN_ID,
      taskIds: ["S00-T02"],
      tranche: "F0-foundation",
      workdir: "/workdir",
    } as const;

    expect(inspectRepairRunPhase(repairInspection(identity), identity)).toBe(
      "startable",
    );
    expect(
      inspectRepairRunPhase(
        repairInspection(identity, { status: "pending" }),
        identity,
      ),
    ).toBe("startable");
    expect(
      inspectRepairRunPhase(
        repairInspection(identity, { status: "running" }),
        identity,
      ),
    ).toBe("accepted");
  });

  it("does not use workflow-most-recent to resolve create without an exact ID", () => {
    const fixtureRoot = root();
    const rawPath = resolve(fixtureRoot, "create.raw");
    const outcomePath = resolve(fixtureRoot, "create.raw.outcome.json");
    const receiptPath = resolve(fixtureRoot, "create.json");
    const identity: LaunchIdentity = {
      attempt: 1,
      baseSha: HEAD_SHA,
      integrationBaseSha: BASE_SHA,
      reservationToken: RESERVATION_TOKEN,
      sourceReviewRun: SOURCE_RUN_ID,
      taskIds: ["S00-T02"],
      tranche: "F0-foundation",
      workdir: "/workdir",
    };
    writeNonzeroLaunchOutcome(rawPath, outcomePath);
    expect(
      discoverCreatedRepairRun({
        identity,
        inspect: () => {
          throw new Error("no exact ID means inspect must not run");
        },
        outcomePath,
        rawPath,
        receiptPath,
      }),
    ).toMatchObject({ kind: "ambiguous" });
  });

  it("recovers only the exact created ID recorded on stdout", () => {
    const fixtureRoot = root();
    const rawPath = resolve(fixtureRoot, "create.raw");
    const outcomePath = resolve(fixtureRoot, "create.raw.outcome.json");
    const receiptPath = resolve(fixtureRoot, "create.json");
    const identity: LaunchIdentity = {
      attempt: 1,
      baseSha: HEAD_SHA,
      integrationBaseSha: BASE_SHA,
      reservationToken: RESERVATION_TOKEN,
      sourceReviewRun: SOURCE_RUN_ID,
      taskIds: ["S00-T02"],
      tranche: "F0-foundation",
      workdir: "/workdir",
    };
    writeFileSync(rawPath, JSON.stringify({ run_id: REPAIR_RUN_ID }));
    const inspectedTargets: string[] = [];
    expect(
      discoverCreatedRepairRun({
        identity,
        inspect: (target) => {
          inspectedTargets.push(target);
          return repairInspection(identity);
        },
        outcomePath,
        rawPath,
        receiptPath,
      }),
    ).toMatchObject({ kind: "found" });
    expect(inspectedTargets).toEqual([REPAIR_RUN_ID]);
  });

  it("allows retry only when the create process provably never spawned", () => {
    const fixtureRoot = root();
    const rawPath = resolve(fixtureRoot, "create.raw");
    const outcomePath = resolve(fixtureRoot, "create.raw.outcome.json");
    const receiptPath = resolve(fixtureRoot, "create.json");
    const identity: LaunchIdentity = {
      attempt: 1,
      baseSha: HEAD_SHA,
      integrationBaseSha: BASE_SHA,
      reservationToken: RESERVATION_TOKEN,
      sourceReviewRun: SOURCE_RUN_ID,
      taskIds: ["S00-T02"],
      tranche: "F0-foundation",
      workdir: "/workdir",
    };
    const originalPath = process.env.PATH;
    process.env.PATH = fixtureRoot;
    try {
      expect(() =>
        runRtkToFile(["fabro", "create", "ignored"], rawPath, {
          outcomePath,
        }),
      ).toThrow("failed (unknown)");
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
    expect(JSON.parse(readFileSync(outcomePath, "utf8"))).toMatchObject({
      errorCode: "ENOENT",
      errorSyscall: "spawnSync rtk",
      kind: "spawn_error",
      schemaVersion: "maestro-rtk-file-outcome/v2",
      signal: null,
      status: null,
    });
    expect(
      discoverCreatedRepairRun({
        identity,
        inspect: () => {
          throw new Error("unspawned create has no run to inspect");
        },
        outcomePath,
        rawPath,
        receiptPath,
      }),
    ).toEqual({ kind: "absent" });
  });

  it("never discards a parseable exact ID because of an outcome marker", () => {
    const fixtureRoot = root();
    const rawPath = resolve(fixtureRoot, "create.raw");
    const outcomePath = resolve(fixtureRoot, "create.raw.outcome.json");
    const receiptPath = resolve(fixtureRoot, "create.json");
    const identity: LaunchIdentity = {
      attempt: 1,
      baseSha: HEAD_SHA,
      integrationBaseSha: BASE_SHA,
      reservationToken: RESERVATION_TOKEN,
      sourceReviewRun: SOURCE_RUN_ID,
      taskIds: ["S00-T02"],
      tranche: "F0-foundation",
      workdir: "/workdir",
    };
    const output = JSON.stringify({ run_id: REPAIR_RUN_ID });
    writeFileSync(rawPath, output);
    writeFileSync(
      outcomePath,
      `${JSON.stringify({
        errorCode: "ENOENT",
        errorSyscall: "spawnSync rtk",
        kind: "spawn_error",
        outputPath: rawPath,
        outputSha256: createHash("sha256").update(output).digest("hex"),
        schemaVersion: "maestro-rtk-file-outcome/v2",
        signal: null,
        status: null,
      })}\n`,
    );
    expect(
      discoverCreatedRepairRun({
        identity,
        inspect: () => {
          throw new Error("exact server inspection unavailable");
        },
        outcomePath,
        rawPath,
        receiptPath,
      }),
    ).toMatchObject({ kind: "ambiguous" });
  });

  it("fails closed on accepted-create stdout loss and never creates twice", () => {
    const authority = validInput();
    const fixtureRoot = resolve(authority.worktreePath, "..");
    const plan = planLegacyIntegrationRecovery(authority);
    const resultPath = resolve(fixtureRoot, "create-unknown-result.json");
    const auditPath = resolve(fixtureRoot, "create-unknown-audit.jsonl");
    const repairRecordPath = resolve(fixtureRoot, "create-unknown.json");
    const rawPath = `${repairRecordPath}.create-1.raw`;
    const outcomePath = `${rawPath}.outcome.json`;
    const receiptPath = `${repairRecordPath}.create-1.json`;
    writeFileSync(
      resultPath,
      `${JSON.stringify(authority.integrationResult)}\n`,
    );
    let createCalls = 0;
    const discover = (identity: LaunchIdentity) =>
      discoverCreatedRepairRun({
        identity,
        inspect: () => {
          throw new Error("no exact ID is available");
        },
        outcomePath,
        rawPath,
        receiptPath,
      });
    const run = () =>
      reconcileLegacyIntegrationRecovery({
        auditPath,
        create: () => {
          createCalls += 1;
          return runRtkToFile(
            [
              "proxy",
              "node",
              "-e",
              "process.stdout.write('partial');process.exit(1)",
            ],
            rawPath,
            { outcomePath },
          );
        },
        discoverCreatedRun: discover,
        identity: {
          baseSha: plan.repairBaseSha,
          sourceReviewRun: plan.sourceReviewRun,
          tranche: authority.tranche,
          workdir: authority.worktreePath,
        },
        inspectRun: () => {
          throw new Error("no created run may be inspected");
        },
        plan,
        repairRecordPath,
        resultPath,
        start: () => {
          throw new Error("no created run may be started");
        },
      });
    expect(run).toThrow("repair create outcome is ambiguous");
    expect(run).toThrow("repair create outcome is ambiguous");
    expect(createCalls).toBe(1);
    expect(JSON.parse(readFileSync(repairRecordPath, "utf8"))).toMatchObject({
      launchAttempt: 1,
      status: "launch_unknown",
    });
  });

  it("fails closed when an accepted create is signaled before stdout", () => {
    const authority = validInput();
    const fixtureRoot = resolve(authority.worktreePath, "..");
    const plan = planLegacyIntegrationRecovery(authority);
    const resultPath = resolve(fixtureRoot, "create-signaled-result.json");
    const auditPath = resolve(fixtureRoot, "create-signaled-audit.jsonl");
    const repairRecordPath = resolve(fixtureRoot, "create-signaled.json");
    const rawPath = `${repairRecordPath}.create-1.raw`;
    const outcomePath = `${rawPath}.outcome.json`;
    const receiptPath = `${repairRecordPath}.create-1.json`;
    const accepted = resolve(fixtureRoot, "create-signaled-accepted.marker");
    const fakeBin = resolve(fixtureRoot, "create-signaled-bin");
    const fakeRtk = resolve(fakeBin, "rtk");
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(
      fakeRtk,
      `#!/bin/sh\nprintf accepted > ${JSON.stringify(accepted)}\nkill -TERM $$\n`,
    );
    chmodSync(fakeRtk, 0o755);
    writeFileSync(
      resultPath,
      `${JSON.stringify(authority.integrationResult)}\n`,
    );
    let createCalls = 0;
    const discoveryKinds: string[] = [];
    const discover = (identity: LaunchIdentity) => {
      const discovery = discoverCreatedRepairRun({
        identity,
        inspect: () => {
          throw new Error("no exact ID is available");
        },
        outcomePath,
        rawPath,
        receiptPath,
      });
      discoveryKinds.push(discovery.kind);
      return discovery;
    };
    const run = () =>
      reconcileLegacyIntegrationRecovery({
        auditPath,
        create: () => {
          createCalls += 1;
          const originalPath = process.env.PATH;
          process.env.PATH = `${fakeBin}:${originalPath ?? ""}`;
          try {
            return runRtkToFile(
              ["fabro", "create", "accepted-then-signaled"],
              rawPath,
              { outcomePath },
            );
          } finally {
            if (originalPath === undefined) delete process.env.PATH;
            else process.env.PATH = originalPath;
          }
        },
        discoverCreatedRun: discover,
        identity: {
          baseSha: plan.repairBaseSha,
          sourceReviewRun: plan.sourceReviewRun,
          tranche: authority.tranche,
          workdir: authority.worktreePath,
        },
        inspectRun: () => {
          throw new Error("no created run may be inspected");
        },
        plan,
        repairRecordPath,
        resultPath,
        start: () => {
          throw new Error("no created run may be started");
        },
      });

    expect(run).toThrow("repair create outcome is ambiguous");
    expect(existsSync(accepted)).toBe(true);
    expect(run).toThrow("repair create outcome is ambiguous");
    expect(discoveryKinds).toEqual(["absent", "ambiguous", "ambiguous"]);
    expect(discoveryKinds.slice(1)).not.toContain("absent");
    expect(createCalls).toBe(1);
    expect(JSON.parse(readFileSync(repairRecordPath, "utf8"))).toMatchObject({
      launchAttempt: 1,
      status: "launch_unknown",
    });
  });

  it.each(["after-create-output", "after-create-record"] as const)(
    "resumes %s without allocating another run ID",
    (faultPoint) => {
      const authority = validInput();
      const fixtureRoot = resolve(authority.worktreePath, "..");
      const plan = planLegacyIntegrationRecovery(authority);
      const resultPath = resolve(fixtureRoot, `${faultPoint}-result.json`);
      const auditPath = resolve(fixtureRoot, `${faultPoint}-audit.jsonl`);
      const repairRecordPath = resolve(fixtureRoot, `${faultPoint}.json`);
      const rawPath = `${repairRecordPath}.create-1.raw`;
      const outcomePath = `${rawPath}.outcome.json`;
      const receiptPath = `${repairRecordPath}.create-1.json`;
      writeFileSync(
        resultPath,
        `${JSON.stringify(authority.integrationResult)}\n`,
      );
      let createCalls = 0;
      let accepted = false;
      let startCalls = 0;
      const discover = (identity: LaunchIdentity) =>
        discoverCreatedRepairRun({
          identity,
          inspect: (target) => {
            expect(target).toBe(REPAIR_RUN_ID);
            return repairInspection(identity, {
              status: accepted ? "running" : "created",
            });
          },
          outcomePath,
          rawPath,
          receiptPath,
        });
      const run = (fault?: typeof faultPoint) =>
        reconcileLegacyIntegrationRecovery({
          auditPath,
          create: (identity) => {
            createCalls += 1;
            runRtkToFile(
              [
                "proxy",
                "node",
                "-e",
                `process.stdout.write(JSON.stringify({run_id:'${REPAIR_RUN_ID}'}))`,
              ],
              rawPath,
              { outcomePath },
            );
            const discovery = discover(identity);
            if (discovery.kind !== "found") throw new Error("create missing");
            return discovery.receipt;
          },
          discoverCreatedRun: discover,
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
          inspectRun: () => (accepted ? "accepted" : "startable"),
          plan,
          repairRecordPath,
          resultPath,
          start: ({ runId }) => {
            expect(runId).toBe(REPAIR_RUN_ID);
            startCalls += 1;
            accepted = true;
          },
        });
      expect(() => run(faultPoint)).toThrow(`crash:${faultPoint}`);
      expect(run()).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
      expect(createCalls).toBe(1);
      expect(startCalls).toBe(1);
    },
  );

  it.each([false, true])(
    "reconciles start nonzero with accepted=%s without creating a second ID",
    (acceptedOnFirstStart) => {
      const authority = validInput();
      const fixtureRoot = resolve(authority.worktreePath, "..");
      const plan = planLegacyIntegrationRecovery(authority);
      const resultPath = resolve(
        fixtureRoot,
        `start-${acceptedOnFirstStart}-result.json`,
      );
      const auditPath = resolve(
        fixtureRoot,
        `start-${acceptedOnFirstStart}-audit.jsonl`,
      );
      const repairRecordPath = resolve(
        fixtureRoot,
        `start-${acceptedOnFirstStart}.json`,
      );
      writeFileSync(
        resultPath,
        `${JSON.stringify(authority.integrationResult)}\n`,
      );
      let accepted = false;
      let createCalls = 0;
      let startCalls = 0;
      const run = () =>
        reconcileLegacyIntegrationRecovery({
          auditPath,
          create: (identity) => {
            createCalls += 1;
            return foundCreatedRun(identity).receipt;
          },
          discoverCreatedRun: () => ({ kind: "absent" }),
          identity: {
            baseSha: plan.repairBaseSha,
            sourceReviewRun: plan.sourceReviewRun,
            tranche: authority.tranche,
            workdir: authority.worktreePath,
          },
          inspectRun: () => (accepted ? "accepted" : "startable"),
          plan,
          repairRecordPath,
          resultPath,
          start: ({ runId, startAttempt }) => {
            expect(runId).toBe(REPAIR_RUN_ID);
            startCalls += 1;
            if (startCalls === 1) {
              accepted = acceptedOnFirstStart;
              const rawPath = `${repairRecordPath}.start-1-${startAttempt}.raw`;
              return runRtkToFile(
                [
                  "proxy",
                  "node",
                  "-e",
                  "process.stdout.write('partial');process.exit(1)",
                ],
                rawPath,
                { outcomePath: `${rawPath}.outcome.json` },
              );
            }
            accepted = true;
          },
        });
      if (acceptedOnFirstStart) {
        expect(run()).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
      } else {
        expect(run).toThrow("failed (1)");
        expect(run()).toEqual({ runId: REPAIR_RUN_ID, status: "launched" });
      }
      expect(createCalls).toBe(1);
      expect(startCalls).toBe(acceptedOnFirstStart ? 1 : 2);
      expect(JSON.parse(readFileSync(repairRecordPath, "utf8"))).toMatchObject({
        createdRunId: REPAIR_RUN_ID,
        launchAttempt: 1,
        status: "launched",
      });
    },
  );

  it.each(["attempt", "priorStatus", "tasks"] as const)(
    "rejects same-token .next residue with illegal %s",
    (tamper) => {
      const authority = validInput();
      const fixtureRoot = resolve(authority.worktreePath, "..");
      const plan = planLegacyIntegrationRecovery(authority);
      const resultPath = resolve(fixtureRoot, `next-${tamper}-result.json`);
      const auditPath = resolve(fixtureRoot, `next-${tamper}-audit.jsonl`);
      const repairRecordPath = resolve(fixtureRoot, `next-${tamper}.json`);
      writeFileSync(
        resultPath,
        `${JSON.stringify(authority.integrationResult)}\n`,
      );
      const reconcile = () =>
        reconcileLegacyIntegrationRecovery({
          auditPath,
          create: (identity) => foundCreatedRun(identity).receipt,
          discoverCreatedRun: () => ({ kind: "absent" }),
          fault: (point) => {
            if (point === "after-reservation") throw new Error("reserved");
          },
          identity: {
            baseSha: plan.repairBaseSha,
            sourceReviewRun: plan.sourceReviewRun,
            tranche: authority.tranche,
            workdir: authority.worktreePath,
          },
          inspectRun: () => "startable",
          plan,
          repairRecordPath,
          resultPath,
          start: () => undefined,
        });
      expect(reconcile).toThrow("reserved");
      const current = JSON.parse(
        readFileSync(repairRecordPath, "utf8"),
      ) as Record<string, unknown>;
      const staged = {
        ...current,
        launchAttempt: tamper === "attempt" ? 2 : 1,
        priorLaunchAttempt: 1,
        priorStartAttempt: 0,
        priorStatus: tamper === "priorStatus" ? "launch_failed" : "preparing",
        status: "launch_failed",
        taskIds: tamper === "tasks" ? ["S00-T01"] : current.taskIds,
      };
      writeFileSync(
        `${repairRecordPath}.next`,
        `${JSON.stringify(staged, null, 2)}\n`,
      );
      expect(reconcile).toThrow(/exact owned transition|illegal transition/);
      expect(JSON.parse(readFileSync(repairRecordPath, "utf8"))).toEqual(
        current,
      );
      expect(existsSync(`${repairRecordPath}.next`)).toBe(true);
    },
  );

  it.each([
    "source",
    "tranche",
    "integrationBase",
    "head",
    "worktree",
    "tasks",
    "audit",
    "result",
  ] as const)("rejects durable fast-path %s swaps", (tamper) => {
    const fixture = durableFixture();
    const expected = {
      ...fixture.expected,
      ...(tamper === "source" ? { sourceReviewRun: REPAIR_RUN_ID } : {}),
      ...(tamper === "tranche" ? { tranche: "F1-foundation" } : {}),
      ...(tamper === "integrationBase"
        ? { integrationBaseSha: "8".repeat(40) }
        : {}),
      ...(tamper === "head" ? { baseSha: "9".repeat(40) } : {}),
      ...(tamper === "worktree"
        ? { workdir: resolve(fixture.authority.worktreePath, "..", "swapped") }
        : {}),
    };
    if (tamper === "audit") {
      writeFileSync(
        fixture.auditPath,
        `${JSON.stringify({ ...fixture.plan.auditEvent, headSha: CONTROL_SHA })}\n`,
      );
    }
    if (tamper === "result") {
      const result = structuredClone(fixture.plan.normalizedResult);
      (result.recovery as Record<string, unknown>).legacyWorktree = resolve(
        fixture.authority.worktreePath,
        "..",
        "swapped",
      );
      writeFileSync(fixture.resultPath, `${JSON.stringify(result)}\n`);
    }
    expect(() =>
      reconcileDurableRepairLaunch({
        ...fixture,
        expected,
        manifestTaskIds:
          tamper === "tasks" ? ["S00-T01"] : fixture.manifestTaskIds,
        inspectRun: () => {
          throw new Error("swapped evidence must fail before inspection");
        },
        start: () => {
          throw new Error("swapped evidence must fail before start");
        },
      }),
    ).toThrow();
  });

  it("uses exact repair workflow inputs and rejects shell-hostile values", () => {
    expect(
      repairWorkflowCreateArgs({
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
        "create",
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
        repairWorkflowCreateArgs({ ...base, controlRoot: hostile }),
      ).toThrow("controlRoot contains shell-unsafe characters");
    }
    expect(() =>
      repairWorkflowCreateArgs({ ...base, sourceReviewRun: "--help" }),
    ).toThrow("sourceReviewRun must be a ULID");
    expect(() =>
      repairWorkflowCreateArgs({ ...base, repairBaseSha: "--help" }),
    ).toThrow("repairBaseSha must be a 40-character Git SHA");
    expect(() => safeAbsolutePath("/tmp/state\n--help", "state path")).toThrow(
      "state path contains shell-unsafe characters",
    );
    expect(repairWorkflowStartArgs(REPAIR_RUN_ID)).toEqual([
      "fabro",
      "start",
      REPAIR_RUN_ID,
      "--json",
      "--no-upgrade-check",
      "--quiet",
    ]);
  });
});
