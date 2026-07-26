import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UpgradePlanInputV1 } from "./contract.js";
import { planUpgrade } from "./plan.js";
import { planUpgradeRecovery } from "./recovery.js";
import { verifyUpgradeRecovery } from "./recoveryVerify.js";

const fixture = (): UpgradePlanInputV1 => {
  const input = JSON.parse(
    readFileSync(
      new URL("../../__fixtures__/upgrade/clean.json", import.meta.url),
      "utf8",
    ),
  ) as UpgradePlanInputV1;
  return {
    ...input,
    manifest: {
      ...input.manifest,
      operations: [
        ...input.manifest.operations,
        {
          id: "delete-obsolete",
          kind: "delete",
          path: "config/obsolete.ts",
          ownership: "template-owned",
          beforeHash: `sha256:${"6".repeat(64)}`,
        },
      ],
    },
    target: {
      ...input.target,
      files: [
        ...input.target.files,
        {
          path: "config/obsolete.ts",
          ownership: "template-owned",
          hash: `sha256:${"6".repeat(64)}`,
        },
      ],
    },
  };
};

const recoveryInput = () => {
  const planInput = fixture();
  const plan = planUpgrade(planInput);
  if (!plan.ok) throw new Error("fixture must plan successfully");
  const verification = {
    schemaVersion: 1,
    planInput,
    expectedPlanFingerprint: plan.planFingerprint,
    observed: {
      preUpgradeCommit: plan.targetCommit,
      upgradedCommit: "b".repeat(40),
      clean: true,
      paths: plan.diff.flatMap((entry) =>
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
  return {
    schemaVersion: 1,
    verification,
    request: {
      id: "recover-upgrade-001",
      requestedAt: "2026-08-09T00:00:00.000Z",
      reason: "Verified upgrade must be reverted after review.",
      operatorApprovalRequired: true,
    },
  };
};

const candidate = () => {
  const recovery = recoveryInput();
  const plan = planUpgradeRecovery(recovery);
  if (!plan.ok) throw new Error("recovery must plan successfully");
  const upgrade = planUpgrade(recovery.verification.planInput);
  if (!upgrade.ok) throw new Error("upgrade must plan successfully");
  const paths = upgrade.diff.flatMap((entry) => {
    if (entry.kind === "add")
      return [{ path: entry.path, state: "absent" as const }];
    if (entry.kind === "move")
      return [
        {
          path: entry.fromPath ?? "",
          state: "present" as const,
          hash: entry.beforeHash ?? "",
        },
        { path: entry.path, state: "absent" as const },
      ];
    return [
      {
        path: entry.path,
        state: "present" as const,
        hash: entry.beforeHash ?? "",
      },
    ];
  });
  return {
    schemaVersion: 1,
    recoveryInput: recovery,
    expectedRecoveryFingerprint: plan.recoveryFingerprint,
    receipt: {
      schemaVersion: 1,
      id: "recovery-receipt-001",
      recoveryFingerprint: plan.recoveryFingerprint,
      status: "completed",
      startedFromCommit: plan.fromCommit,
      restoredFromCommit: plan.restoreCommit,
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
      paths,
    },
  };
};

const codes = (input: unknown): readonly string[] => {
  const result = verifyUpgradeRecovery(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

describe("completed upgrade recovery verification", () => {
  it("verifies exact receipt commits and restored hashes and absences", () => {
    const input = candidate();
    const before = JSON.stringify(input);
    const first = verifyUpgradeRecovery(input);
    const second = verifyUpgradeRecovery({
      observed: {
        ...input.observed,
        paths: [...input.observed.paths].reverse(),
      },
      receipt: input.receipt,
      expectedRecoveryFingerprint: input.expectedRecoveryFingerprint,
      recoveryInput: input.recoveryInput,
      schemaVersion: 1,
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mode: "verify-only",
      executionAvailable: false,
      recovered: true,
      verified: true,
      recoveryCommit: "c".repeat(40),
      restoredFromCommit: "a".repeat(40),
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("rejects stale recovery fingerprints and receipt identities", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        expectedRecoveryFingerprint: `sha256:${"0".repeat(64)}`,
      }),
    ).toContain("UPGRADE_RECOVERY_VERIFY_FINGERPRINT_MISMATCH");
    expect(
      codes({
        ...input,
        receipt: { ...input.receipt, startedFromCommit: "d".repeat(40) },
      }),
    ).toContain("UPGRADE_RECOVERY_VERIFY_RECEIPT_TAMPERED");
  });

  it("rejects unauthorized receipts and dirty or mismatched recovery commits", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        receipt: {
          ...input.receipt,
          authorization: { ...input.receipt.authorization, approved: false },
        },
      }),
    ).toContain("UPGRADE_RECOVERY_VERIFY_UNAUTHORIZED");
    expect(
      codes({ ...input, observed: { ...input.observed, clean: false } }),
    ).toContain("UPGRADE_RECOVERY_VERIFY_TARGET_DIRTY");
    expect(
      codes({
        ...input,
        observed: { ...input.observed, currentCommit: "d".repeat(40) },
      }),
    ).toContain("UPGRADE_RECOVERY_VERIFY_COMMIT_MISMATCH");
  });

  it("rejects restored hash and absence mismatches", () => {
    const input = candidate();
    const presentIndex = input.observed.paths.findIndex(
      ({ state }) => state === "present",
    );
    const absentIndex = input.observed.paths.findIndex(
      ({ state }) => state === "absent",
    );
    const badHash = input.observed.paths.map((entry, index) =>
      index === presentIndex && entry.state === "present"
        ? { ...entry, hash: `sha256:${"0".repeat(64)}` }
        : entry,
    );
    expect(
      codes({ ...input, observed: { ...input.observed, paths: badHash } }),
    ).toContain("UPGRADE_RECOVERY_VERIFY_HASH_MISMATCH");
    const absent = input.observed.paths[absentIndex];
    if (!absent) return;
    const badAbsence = input.observed.paths.map((entry, index) =>
      index === absentIndex
        ? {
            path: absent.path,
            state: "present" as const,
            hash: `sha256:${"9".repeat(64)}`,
          }
        : entry,
    );
    expect(
      codes({ ...input, observed: { ...input.observed, paths: badAbsence } }),
    ).toContain("UPGRADE_RECOVERY_VERIFY_EXPECTED_ABSENT");
  });

  it("rejects missing, unexpected, duplicate, and unknown evidence", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        observed: { ...input.observed, paths: input.observed.paths.slice(1) },
      }),
    ).toContain("UPGRADE_RECOVERY_VERIFY_EVIDENCE_MISSING");
    expect(
      codes({
        ...input,
        observed: {
          ...input.observed,
          paths: [
            ...input.observed.paths,
            { path: "unexpected.ts", state: "absent" },
          ],
        },
      }),
    ).toContain("UPGRADE_RECOVERY_VERIFY_EVIDENCE_UNEXPECTED");
    expect(
      codes({
        ...input,
        observed: {
          ...input.observed,
          paths: [...input.observed.paths, input.observed.paths[0]],
        },
      }),
    ).toEqual(["UPGRADE_RECOVERY_VERIFY_INPUT_INVALID"]);
    expect(codes({ ...input, execute: true })).toEqual([
      "UPGRADE_RECOVERY_VERIFY_INPUT_INVALID",
    ]);
  });
});
