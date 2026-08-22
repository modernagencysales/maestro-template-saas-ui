import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UpgradePlanInputV1 } from "./contract.js";
import { planUpgrade } from "./plan.js";
import { planUpgradeRecovery } from "./recovery.js";
import {
  auditUpgradeRecovery,
  recoveryPathEvidenceFingerprint,
} from "./recoveryAudit.js";

const fixture = (): UpgradePlanInputV1 =>
  JSON.parse(
    readFileSync(
      new URL("../../__fixtures__/upgrade/clean.json", import.meta.url),
      "utf8",
    ),
  ) as UpgradePlanInputV1;

const recoveryVerification = () => {
  const planInput = fixture();
  const upgrade = planUpgrade(planInput);
  if (!upgrade.ok) throw new Error("fixture must plan successfully");
  const appliedPaths = upgrade.diff.flatMap((entry) =>
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
  );
  const verification = {
    schemaVersion: 1,
    planInput,
    expectedPlanFingerprint: upgrade.planFingerprint,
    observed: {
      preUpgradeCommit: upgrade.targetCommit,
      upgradedCommit: "b".repeat(40),
      clean: true,
      paths: appliedPaths,
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
  const restoredPaths = upgrade.diff.flatMap((entry) =>
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
  );
  return {
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
      paths: restoredPaths,
    },
  };
};

const candidate = () => {
  const verificationInput = recoveryVerification();
  const pathEvidenceFingerprint =
    recoveryPathEvidenceFingerprint(verificationInput);
  if (!pathEvidenceFingerprint) throw new Error("evidence must fingerprint");
  return {
    schemaVersion: 1,
    verificationInput,
    acceptedRecord: {
      targetId: "client/acme",
      receiptId: verificationInput.receipt.id,
      recoveryFingerprint: verificationInput.receipt.recoveryFingerprint,
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

const codes = (input: unknown): readonly string[] => {
  const result = auditUpgradeRecovery(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

describe("upgrade recovery replay audit", () => {
  it("produces deterministic audit evidence for an accepted recovery", () => {
    const input = candidate();
    const before = JSON.stringify(input);
    const first = auditUpgradeRecovery(input);
    const second = auditUpgradeRecovery({
      audit: input.audit,
      acceptedRecord: input.acceptedRecord,
      verificationInput: {
        ...input.verificationInput,
        observed: {
          ...input.verificationInput.observed,
          paths: [...input.verificationInput.observed.paths].reverse(),
        },
      },
      schemaVersion: 1,
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mode: "audit-only",
      executionAvailable: false,
      replaySafe: true,
      targetId: "client/acme",
      receiptId: "recovery-receipt-001",
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("rejects audit timestamps outside the accepted window", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        audit: { ...input.audit, auditedAt: "2026-08-11T00:00:00.000Z" },
      }),
    ).toContain("UPGRADE_RECOVERY_AUDIT_STALE_WINDOW");
  });

  it("rejects duplicate receipt and fingerprint reuse", () => {
    const input = candidate();
    const prior = {
      targetId: input.audit.targetId,
      receiptId: input.acceptedRecord.receiptId,
      recoveryFingerprint: `sha256:${"0".repeat(64)}`,
      recoveryCommit: "d".repeat(40),
    };
    expect(
      codes({
        ...input,
        audit: { ...input.audit, priorReceipts: [prior] },
      }),
    ).toContain("UPGRADE_RECOVERY_AUDIT_DUPLICATE_RECEIPT");
    expect(
      codes({
        ...input,
        audit: {
          ...input.audit,
          priorReceipts: [
            {
              ...prior,
              receiptId: "another-receipt",
              recoveryFingerprint: input.acceptedRecord.recoveryFingerprint,
            },
          ],
        },
      }),
    ).toContain("UPGRADE_RECOVERY_AUDIT_DUPLICATE_FINGERPRINT");
  });

  it("rejects path-evidence drift", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        acceptedRecord: {
          ...input.acceptedRecord,
          pathEvidenceFingerprint: `sha256:${"0".repeat(64)}`,
        },
      }),
    ).toContain("UPGRADE_RECOVERY_AUDIT_PATH_EVIDENCE_DRIFT");
  });

  it("rejects cross-target replay directly or through prior use", () => {
    const input = candidate();
    expect(
      codes({ ...input, audit: { ...input.audit, targetId: "client/other" } }),
    ).toContain("UPGRADE_RECOVERY_AUDIT_CROSS_TARGET_REPLAY");
    expect(
      codes({
        ...input,
        audit: {
          ...input.audit,
          priorReceipts: [
            {
              targetId: "client/other",
              receiptId: input.acceptedRecord.receiptId,
              recoveryFingerprint: input.acceptedRecord.recoveryFingerprint,
              recoveryCommit: input.acceptedRecord.recoveryCommit,
            },
          ],
        },
      }),
    ).toContain("UPGRADE_RECOVERY_AUDIT_CROSS_TARGET_REPLAY");
  });

  it("rejects upstream verification drift and unknown fields", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        verificationInput: {
          ...input.verificationInput,
          observed: { ...input.verificationInput.observed, clean: false },
        },
      }),
    ).toContain("UPGRADE_RECOVERY_AUDIT_VERIFICATION_FAILED");
    expect(codes({ ...input, execute: true })).toEqual([
      "UPGRADE_RECOVERY_AUDIT_INPUT_INVALID",
    ]);
  });
});
