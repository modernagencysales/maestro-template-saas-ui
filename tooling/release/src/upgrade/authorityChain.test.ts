import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UpgradePlanInputV1 } from "./contract.js";
import { planUpgrade } from "./plan.js";
import { planUpgradeRecovery } from "./recovery.js";
import {
  auditUpgradeRecovery,
  recoveryPathEvidenceFingerprint,
} from "./recoveryAudit.js";
import { compileRecoveryCheckpoint } from "./recoveryCheckpoint.js";
import { verifyUpgradeRecovery } from "./recoveryVerify.js";
import { verifyAppliedUpgrade } from "./verify.js";

const fixture = (): UpgradePlanInputV1 =>
  JSON.parse(
    readFileSync(
      new URL("../../__fixtures__/upgrade/clean.json", import.meta.url),
      "utf8",
    ),
  ) as UpgradePlanInputV1;

describe("full upgrade authority chain", () => {
  it("binds every accepted stage and fails closed on plan and recovery drift", () => {
    const planInput = fixture();
    const sourceBefore = JSON.stringify(planInput);

    const upgradePlan = planUpgrade(planInput);
    expect(upgradePlan).toMatchObject({
      ok: true,
      mode: "plan-only",
      writeAvailable: false,
    });
    if (!upgradePlan.ok) return;

    const appliedVerificationInput = {
      schemaVersion: 1,
      planInput,
      expectedPlanFingerprint: upgradePlan.planFingerprint,
      observed: {
        preUpgradeCommit: upgradePlan.targetCommit,
        upgradedCommit: "b".repeat(40),
        clean: true,
        paths: upgradePlan.diff.flatMap((entry) =>
          entry.kind === "delete"
            ? [{ path: entry.path, state: "absent" as const }]
            : entry.kind === "move"
              ? [
                  { path: entry.fromPath ?? "", state: "absent" as const },
                  {
                    path: entry.path,
                    state: "present" as const,
                    hash: entry.afterHash ?? "",
                  },
                ]
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
    const appliedVerification = verifyAppliedUpgrade(appliedVerificationInput);
    expect(appliedVerification).toMatchObject({
      ok: true,
      applied: true,
      verified: true,
      planFingerprint: upgradePlan.planFingerprint,
      preUpgradeCommit: upgradePlan.targetCommit,
      upgradedCommit: "b".repeat(40),
    });

    const planDrift = verifyAppliedUpgrade({
      ...appliedVerificationInput,
      expectedPlanFingerprint: `sha256:${"0".repeat(64)}`,
    });
    expect(planDrift).toMatchObject({
      ok: false,
      applied: false,
      verified: false,
      resolutions: [{ code: "UPGRADE_VERIFY_FINGERPRINT_MISMATCH" }],
    });

    const recoveryInput = {
      schemaVersion: 1,
      verification: appliedVerificationInput,
      request: {
        id: "recover-upgrade-authority-chain",
        requestedAt: "2026-08-09T00:00:00.000Z",
        reason: "Exercise the reviewed recovery authority chain.",
        operatorApprovalRequired: true,
      },
    };
    const recoveryPlan = planUpgradeRecovery(recoveryInput);
    expect(recoveryPlan).toMatchObject({
      ok: true,
      mode: "plan-only",
      executionAvailable: false,
      verifiedPlanFingerprint: upgradePlan.planFingerprint,
      fromCommit: "b".repeat(40),
      restoreCommit: upgradePlan.targetCommit,
      customRollbackEngine: false,
    });
    if (!recoveryPlan.ok) return;

    const recoveryVerificationInput = {
      schemaVersion: 1,
      recoveryInput,
      expectedRecoveryFingerprint: recoveryPlan.recoveryFingerprint,
      receipt: {
        schemaVersion: 1,
        id: "recovery-receipt-authority-chain",
        recoveryFingerprint: recoveryPlan.recoveryFingerprint,
        status: "completed",
        startedFromCommit: recoveryPlan.fromCommit,
        restoredFromCommit: recoveryPlan.restoreCommit,
        recoveryCommit: "c".repeat(40),
        completedAt: "2026-08-09T01:00:00.000Z",
        authorization: {
          approved: true,
          evidenceRef: "evidence/recovery-authority-chain",
        },
      },
      observed: {
        currentCommit: "c".repeat(40),
        clean: true,
        paths: upgradePlan.diff.flatMap((entry) =>
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
    const recoveryVerification = verifyUpgradeRecovery(
      recoveryVerificationInput,
    );
    expect(recoveryVerification).toMatchObject({
      ok: true,
      recovered: true,
      verified: true,
      recoveryFingerprint: recoveryPlan.recoveryFingerprint,
      restoredFromCommit: recoveryPlan.restoreCommit,
      recoveryCommit: "c".repeat(40),
    });

    const recoveryDrift = verifyUpgradeRecovery({
      ...recoveryVerificationInput,
      expectedRecoveryFingerprint: `sha256:${"0".repeat(64)}`,
    });
    expect(recoveryDrift).toMatchObject({
      ok: false,
      recovered: false,
      verified: false,
      resolutions: [{ code: "UPGRADE_RECOVERY_VERIFY_FINGERPRINT_MISMATCH" }],
    });

    const pathEvidenceFingerprint = recoveryPathEvidenceFingerprint(
      recoveryVerificationInput,
    );
    expect(pathEvidenceFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/u);
    if (!pathEvidenceFingerprint) return;
    const auditInput = {
      schemaVersion: 1,
      verificationInput: recoveryVerificationInput,
      acceptedRecord: {
        targetId: "client/acme",
        receiptId: recoveryVerificationInput.receipt.id,
        recoveryFingerprint: recoveryPlan.recoveryFingerprint,
        recoveryCommit: recoveryVerificationInput.receipt.recoveryCommit,
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
    const replayAudit = auditUpgradeRecovery(auditInput);
    expect(replayAudit).toMatchObject({
      ok: true,
      mode: "audit-only",
      executionAvailable: false,
      replaySafe: true,
      targetId: "client/acme",
      receiptId: recoveryVerificationInput.receipt.id,
      recoveryFingerprint: recoveryPlan.recoveryFingerprint,
      recoveryCommit: recoveryVerificationInput.receipt.recoveryCommit,
      pathEvidenceFingerprint,
    });

    const checkpoint = compileRecoveryCheckpoint({
      schemaVersion: 1,
      auditInput,
    });
    expect(checkpoint).toMatchObject({
      ok: true,
      mode: "compile-only",
      executionAvailable: false,
      complete: true,
      targetId: "client/acme",
      receiptId: recoveryVerificationInput.receipt.id,
      upgradePlanFingerprint: upgradePlan.planFingerprint,
      recoveryFingerprint: recoveryPlan.recoveryFingerprint,
      restoredCommit: upgradePlan.targetCommit,
      recoveryCommit: recoveryVerificationInput.receipt.recoveryCommit,
      pathEvidenceDigest: pathEvidenceFingerprint,
      rollbackPosture: {
        code: "git-owned",
        customRollbackEngine: false,
        data: "separate-authorized-plan",
        provider: "separate-operator-plan",
      },
    });
    expect(JSON.stringify(planInput)).toBe(sourceBefore);
  });
});
