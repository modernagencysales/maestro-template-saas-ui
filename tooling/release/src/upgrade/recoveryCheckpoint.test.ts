import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UpgradePlanInputV1 } from "./contract.js";
import { planUpgrade } from "./plan.js";
import { planUpgradeRecovery } from "./recovery.js";
import { recoveryPathEvidenceFingerprint } from "./recoveryAudit.js";
import { compileRecoveryCheckpoint } from "./recoveryCheckpoint.js";

const fixture = (): UpgradePlanInputV1 =>
  JSON.parse(
    readFileSync(
      new URL("../../__fixtures__/upgrade/clean.json", import.meta.url),
      "utf8",
    ),
  ) as UpgradePlanInputV1;

const auditInput = () => {
  const planInput = fixture();
  const upgrade = planUpgrade(planInput);
  if (!upgrade.ok) throw new Error("fixture must plan successfully");
  const verification = {
    schemaVersion: 1,
    planInput,
    expectedPlanFingerprint: upgrade.planFingerprint,
    observed: {
      preUpgradeCommit: upgrade.targetCommit,
      upgradedCommit: "b".repeat(40),
      clean: true,
      paths: upgrade.diff.flatMap((entry) =>
        entry.kind === "move"
          ? [
              { path: entry.fromPath ?? "", state: "absent" as const },
              {
                path: entry.path,
                state: "present" as const,
                hash: entry.afterHash ?? "",
              },
            ]
          : entry.kind === "delete"
            ? [{ path: entry.path, state: "absent" as const }]
            : [
                {
                  path: entry.path,
                  state: "present" as const,
                  hash: entry.afterHash ?? "",
                },
              ],
      ),
    },
  };
  const recoveryInput = {
    schemaVersion: 1,
    verification,
    request: {
      id: "recover-upgrade-001",
      requestedAt: "2026-08-09T00:00:00.000Z",
      reason: "Verified upgrade must be reverted after review.",
      operatorApprovalRequired: true,
    },
  };
  const recovery = planUpgradeRecovery(recoveryInput);
  if (!recovery.ok) throw new Error("recovery must plan successfully");
  const verificationInput = {
    schemaVersion: 1,
    recoveryInput,
    expectedRecoveryFingerprint: recovery.recoveryFingerprint,
    receipt: {
      schemaVersion: 1,
      id: "recovery-receipt-001",
      recoveryFingerprint: recovery.recoveryFingerprint,
      status: "completed",
      startedFromCommit: recovery.fromCommit,
      restoredFromCommit: recovery.restoreCommit,
      recoveryCommit: "c".repeat(40),
      completedAt: "2026-08-09T01:00:00.000Z",
      authorization: {
        approved: true,
        evidenceRef: "evidence/recovery-approval",
      },
    },
    observed: {
      currentCommit: "c".repeat(40),
      clean: true,
      paths: upgrade.diff.flatMap((entry) =>
        entry.kind === "add"
          ? [{ path: entry.path, state: "absent" as const }]
          : entry.kind === "move"
            ? [
                {
                  path: entry.fromPath ?? "",
                  state: "present" as const,
                  hash: entry.beforeHash ?? "",
                },
                { path: entry.path, state: "absent" as const },
              ]
            : [
                {
                  path: entry.path,
                  state: "present" as const,
                  hash: entry.beforeHash ?? "",
                },
              ],
      ),
    },
  };
  const pathEvidenceFingerprint =
    recoveryPathEvidenceFingerprint(verificationInput);
  if (!pathEvidenceFingerprint) throw new Error("evidence must fingerprint");
  return {
    schemaVersion: 1,
    verificationInput,
    acceptedRecord: {
      targetId: "client/acme",
      receiptId: verificationInput.receipt.id,
      recoveryFingerprint: recovery.recoveryFingerprint,
      recoveryCommit: verificationInput.receipt.recoveryCommit,
      pathEvidenceFingerprint,
    },
    audit: {
      targetId: "client/acme",
      windowOpensAt: "2026-08-09T00:00:00.000Z",
      windowClosesAt: "2026-08-10T00:00:00.000Z",
      auditedAt: "2026-08-09T02:00:00.000Z",
      priorReceipts: [],
    },
  };
};

const candidate = () => ({ schemaVersion: 1, auditInput: auditInput() });

const codes = (input: unknown): readonly string[] => {
  const result = compileRecoveryCheckpoint(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

describe("accepted recovery checkpoint compilation", () => {
  it("binds the complete accepted recovery authority deterministically", () => {
    const input = candidate();
    const before = JSON.stringify(input);
    const first = compileRecoveryCheckpoint(input);
    const second = compileRecoveryCheckpoint({
      auditInput: {
        ...input.auditInput,
        verificationInput: {
          ...input.auditInput.verificationInput,
          observed: {
            ...input.auditInput.verificationInput.observed,
            paths: [
              ...input.auditInput.verificationInput.observed.paths,
            ].reverse(),
          },
        },
      },
      schemaVersion: 1,
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mode: "compile-only",
      executionAvailable: false,
      complete: true,
      targetId: "client/acme",
      upgradePlanFingerprint: expect.stringMatching(/^sha256:/u),
      recoveryFingerprint: expect.stringMatching(/^sha256:/u),
      restoredCommit: "a".repeat(40),
      recoveryCommit: "c".repeat(40),
      pathEvidenceDigest: expect.stringMatching(/^sha256:/u),
      rollbackPosture: {
        code: "git-owned",
        customRollbackEngine: false,
        data: "separate-authorized-plan",
        provider: "separate-operator-plan",
      },
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("fails closed on stale, duplicate, and cross-target audit authority", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        auditInput: {
          ...input.auditInput,
          audit: {
            ...input.auditInput.audit,
            auditedAt: "2026-08-11T00:00:00.000Z",
          },
        },
      }),
    ).toContain("UPGRADE_RECOVERY_CHECKPOINT_STALE");
    expect(
      codes({
        ...input,
        auditInput: {
          ...input.auditInput,
          audit: {
            ...input.auditInput.audit,
            priorReceipts: [
              {
                targetId: input.auditInput.audit.targetId,
                receiptId: input.auditInput.acceptedRecord.receiptId,
                recoveryFingerprint: `sha256:${"0".repeat(64)}`,
                recoveryCommit: "d".repeat(40),
              },
            ],
          },
        },
      }),
    ).toContain("UPGRADE_RECOVERY_CHECKPOINT_DUPLICATE");
    expect(
      codes({
        ...input,
        auditInput: {
          ...input.auditInput,
          audit: { ...input.auditInput.audit, targetId: "client/other" },
        },
      }),
    ).toContain("UPGRADE_RECOVERY_CHECKPOINT_CROSS_TARGET");
  });

  it("fails closed on dirty or incomplete restored evidence", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        auditInput: {
          ...input.auditInput,
          verificationInput: {
            ...input.auditInput.verificationInput,
            observed: {
              ...input.auditInput.verificationInput.observed,
              clean: false,
            },
          },
        },
      }),
    ).toContain("UPGRADE_RECOVERY_CHECKPOINT_DIRTY");
    expect(
      codes({
        ...input,
        auditInput: {
          ...input.auditInput,
          verificationInput: {
            ...input.auditInput.verificationInput,
            observed: {
              ...input.auditInput.verificationInput.observed,
              paths: input.auditInput.verificationInput.observed.paths.slice(1),
            },
          },
        },
      }),
    ).toContain("UPGRADE_RECOVERY_CHECKPOINT_INCOMPLETE");
  });

  it("rejects unknown packet controls", () => {
    expect(codes({ ...candidate(), persist: true })).toEqual([
      "UPGRADE_RECOVERY_CHECKPOINT_INPUT_INVALID",
    ]);
  });
});
