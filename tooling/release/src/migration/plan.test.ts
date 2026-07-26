import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MigrationPlanInputV1, MigrationReceiptV1 } from "./contract.js";
import {
  migrationReceiptSigningPayload,
  planMigrationHandoff,
} from "./plan.js";

const keys = generateKeyPairSync("ed25519");
const receiptAuthority = {
  issuerId: "test-release-issuer",
  keyId: "test-key-1",
  publicKeyPem: keys.publicKey
    .export({ type: "spki", format: "pem" })
    .toString(),
  consumedReplayIdentities: [] as string[],
};
const signed = (
  receipt: Omit<MigrationReceiptV1, "signature">,
): MigrationReceiptV1 => ({
  ...receipt,
  signature: {
    algorithm: "ed25519",
    value: sign(
      null,
      migrationReceiptSigningPayload(receipt),
      keys.privateKey,
    ).toString("base64"),
  },
});
const resigned = (receipt: MigrationReceiptV1): MigrationReceiptV1 => {
  const { signature, ...unsigned } = receipt;
  void signature;
  return signed(unsigned);
};

const fixture = (): MigrationPlanInputV1 =>
  JSON.parse(
    readFileSync(
      new URL("../../__fixtures__/migration/clean.json", import.meta.url),
      "utf8",
    ),
  ) as MigrationPlanInputV1;

const failureCodes = (candidate: unknown): readonly string[] => {
  const result = planMigrationHandoff(candidate);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

const completedReceipt = (input: MigrationPlanInputV1): MigrationReceiptV1 => {
  const planned = planMigrationHandoff(input);
  if (!planned.ok) throw new Error("fixture must produce a plan");
  return signed({
    schemaVersion: 1,
    id: "receipt-backfill-workflow-graph-v2",
    transitionId: input.transition.id,
    migrationId: input.migration.id,
    migrationFingerprint: planned.migrationFingerprint,
    status: "completed",
    completedAt: "2026-08-04T00:00:00.000Z",
    issuer: { id: receiptAuthority.issuerId, keyId: receiptAuthority.keyId },
    replayIdentity: "replay-backfill-workflow-graph-v2",
    authorization: {
      approved: true,
      evidenceRef: "evidence/operator-approval",
    },
    previewCounts: input.migration.previewCounts,
    migrateCounts: { attempted: 9, succeeded: 9, failed: 0 },
    evidence: [
      { id: "migration-verification", evidenceRef: "evidence/verification" },
      { id: "preview-counts", evidenceRef: "evidence/preview" },
    ],
  });
};

describe("migration handoff planning", () => {
  it("plans expand, compatible code, migration, window, and contract deterministically", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const first = planMigrationHandoff(input);
    const second = planMigrationHandoff({
      ...input,
      migration: {
        ...input.migration,
        evidenceRequirements: [
          ...input.migration.evidenceRequirements,
        ].reverse(),
      },
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mode: "plan-only",
      executionAvailable: false,
      steps: [
        { kind: "expand" },
        { kind: "backward-compatible-code" },
        { kind: "preview" },
        { kind: "migrate" },
        { kind: "compatibility-window" },
        { kind: "contract" },
      ],
      fileUpgrade: {
        blocked: true,
        code: "MIGRATION_RECEIPT_REQUIRED",
      },
      operatorCommand:
        "pnpm maestro -- migration run backfill-workflow-graph-v2 --write",
    });
    expect(JSON.stringify(first)).not.toContain("dataValues");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("unblocks file upgrade only for a matching authorized receipt", () => {
    const input = fixture();
    const candidate = {
      ...input,
      receipt: completedReceipt(input),
      receiptAuthority,
    };
    const before = JSON.stringify(candidate);
    expect(planMigrationHandoff(candidate)).toMatchObject({
      ok: true,
      fileUpgrade: {
        blocked: false,
        receiptId: "receipt-backfill-workflow-graph-v2",
      },
    });
    expect(JSON.stringify(candidate)).toBe(before);
  });

  it("rejects unsigned authority, untrusted issuers, invalid signatures, and replay", () => {
    const input = fixture();
    const receipt = completedReceipt(input);
    expect(failureCodes({ ...input, receipt })).toContain(
      "MIGRATION_RECEIPT_AUTHORITY_REQUIRED",
    );
    expect(
      failureCodes({
        ...input,
        receipt,
        receiptAuthority: { ...receiptAuthority, issuerId: "other" },
      }),
    ).toContain("MIGRATION_RECEIPT_ISSUER_UNTRUSTED");
    expect(
      failureCodes({
        ...input,
        receipt: {
          ...receipt,
          signature: { ...receipt.signature, value: "Zm9yZ2Vk" },
        },
        receiptAuthority,
      }),
    ).toContain("MIGRATION_RECEIPT_SIGNATURE_INVALID");
    expect(
      failureCodes({
        ...input,
        receipt,
        receiptAuthority: {
          ...receiptAuthority,
          consumedReplayIdentities: [receipt.replayIdentity],
        },
      }),
    ).toContain("MIGRATION_RECEIPT_REPLAYED");
  });

  it.each([
    ["unknown", "MIGRATION_SOURCE_UNKNOWN"],
    ["older", "MIGRATION_SOURCE_OLDER"],
    ["skipped", "MIGRATION_SOURCE_SKIPPED"],
    ["newer", "MIGRATION_SOURCE_NEWER"],
  ] as const)("fails closed for %s source relation", (relation, code) => {
    const input = fixture();
    expect(
      failureCodes({ ...input, target: { ...input.target, relation } }),
    ).toContain(code);
  });

  it("requires the exact immediate prior version", () => {
    const input = fixture();
    expect(
      failureCodes({
        ...input,
        target: { ...input.target, version: "0.1.0-alpha.other" },
      }),
    ).toContain("MIGRATION_SOURCE_MISMATCH");
  });

  it("requires expand before backward-compatible code", () => {
    const input = fixture();
    expect(
      failureCodes({ ...input, phases: [...input.phases].reverse() }),
    ).toContain("MIGRATION_PHASE_ORDER_INVALID");
  });

  it("rejects inconsistent counts and an early contract", () => {
    const input = fixture();
    expect(
      failureCodes({
        ...input,
        migration: {
          ...input.migration,
          previewCounts: { scanned: 1, eligible: 2, alreadyCompatible: 0 },
        },
      }),
    ).toContain("MIGRATION_COUNTS_INVALID");
    expect(
      failureCodes({
        ...input,
        migration: {
          ...input.migration,
          compatibilityWindow: {
            ...input.migration.compatibilityWindow,
            contractNotBefore: "2026-08-07T00:00:00.000Z",
          },
        },
      }),
    ).toContain("MIGRATION_COMPATIBILITY_WINDOW_INVALID");
  });

  it.each([
    "approvalEvidenceRef",
    "backupOrExportEvidenceRef",
    "rollForwardPlan",
  ] as const)("rejects irreversible migration without %s", (field) => {
    const input = fixture();
    const recovery = {
      kind: "roll-forward-only" as const,
      reason: "Source records cannot be reconstructed.",
      operatorCommand: "pnpm maestro -- migration roll-forward --write",
      approvalEvidenceRef: "evidence/approval",
      backupOrExportEvidenceRef: "evidence/export",
      rollForwardPlan: "Deploy the reviewed repair migration.",
      [field]: undefined,
    };
    expect(
      failureCodes({
        ...input,
        migration: { ...input.migration, irreversible: true, recovery },
      }),
    ).toContain("MIGRATION_IRREVERSIBLE_UNSAFE");
  });

  it("accepts an explicit fully evidenced roll-forward-only disposition", () => {
    const input = fixture();
    expect(
      planMigrationHandoff({
        ...input,
        migration: {
          ...input.migration,
          irreversible: true,
          recovery: {
            kind: "roll-forward-only",
            reason: "Source records cannot be reconstructed.",
            operatorCommand: "pnpm maestro -- migration roll-forward --write",
            approvalEvidenceRef: "evidence/approval",
            backupOrExportEvidenceRef: "evidence/export",
            rollForwardPlan: "Deploy the reviewed repair migration.",
          },
        },
      }),
    ).toMatchObject({
      ok: true,
      recovery: { kind: "roll-forward-only" },
    });
  });

  it("rejects stale, tampered, and unauthorized receipts", () => {
    const input = fixture();
    const receipt = completedReceipt(input);
    expect(
      failureCodes({
        ...input,
        receipt: resigned({
          ...receipt,
          migrationFingerprint: `sha256:${"0".repeat(64)}`,
        }),
        receiptAuthority,
      }),
    ).toContain("MIGRATION_RECEIPT_STALE");
    expect(
      failureCodes({
        ...input,
        receipt: resigned({
          ...receipt,
          migrateCounts: { ...receipt.migrateCounts, succeeded: 8 },
        }),
        receiptAuthority,
      }),
    ).toContain("MIGRATION_RECEIPT_TAMPERED");
    expect(
      failureCodes({
        ...input,
        receipt: resigned({
          ...receipt,
          authorization: { ...receipt.authorization, approved: false },
        }),
        receiptAuthority,
      }),
    ).toContain("MIGRATION_RECEIPT_UNAUTHORIZED");
  });

  it("rejects missing receipt evidence and unknown fields", () => {
    const input = fixture();
    const receipt = completedReceipt(input);
    expect(
      failureCodes({
        ...input,
        receipt: resigned({ ...receipt, evidence: receipt.evidence.slice(1) }),
        receiptAuthority,
      }),
    ).toContain("MIGRATION_RECEIPT_EVIDENCE_MISSING");
    expect(failureCodes({ ...input, execute: true })).toEqual([
      "MIGRATION_INPUT_INVALID",
    ]);
  });
});
import { generateKeyPairSync, sign } from "node:crypto";
