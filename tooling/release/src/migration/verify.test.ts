import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  MigrationPlanInputV1,
  MigrationReceiptV1,
} from "./contract.js";
import { planMigrationHandoff } from "./plan.js";
import { verifyMigrationHandoff } from "./verify.js";

const fixture = (): MigrationPlanInputV1 =>
  JSON.parse(
    readFileSync(
      new URL("../../__fixtures__/migration/clean.json", import.meta.url),
      "utf8",
    ),
  ) as MigrationPlanInputV1;

const receiptFor = (input: MigrationPlanInputV1): MigrationReceiptV1 => {
  const plan = planMigrationHandoff(input);
  if (!plan.ok) throw new Error("fixture must plan successfully");
  return {
    schemaVersion: 1,
    id: "receipt-backfill-workflow-graph-v2",
    transitionId: input.transition.id,
    migrationId: input.migration.id,
    migrationFingerprint: plan.migrationFingerprint,
    status: "completed",
    completedAt: "2026-08-04T00:00:00.000Z",
    authorization: {
      approved: true,
      evidenceRef: "evidence/operator-approval",
    },
    previewCounts: input.migration.previewCounts,
    migrateCounts: { attempted: 9, succeeded: 9, failed: 0 },
    evidence: [
      { id: "preview-counts", evidenceRef: "evidence/preview" },
      { id: "migration-verification", evidenceRef: "evidence/verification" },
    ],
  };
};

const fingerprintFor = (input: MigrationPlanInputV1): string => {
  const plan = planMigrationHandoff(input);
  if (!plan.ok) throw new Error("fixture must plan successfully");
  return plan.migrationFingerprint;
};

const codes = (candidate: unknown): readonly string[] => {
  const result = verifyMigrationHandoff(candidate);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

describe("migration receipt verification bridge", () => {
  it("passes a file upgrade that declares no data migration", () => {
    const candidate = {
      schemaVersion: 1,
      fileUpgrade: {
        planFingerprint: `sha256:${"1".repeat(64)}`,
        dataMigrationRequired: false,
      },
    };
    const before = JSON.stringify(candidate);
    expect(verifyMigrationHandoff(candidate)).toMatchObject({
      ok: true,
      mode: "verify-only",
      writeAvailable: false,
      receiptVerified: false,
      migration: { required: false },
    });
    expect(JSON.stringify(candidate)).toBe(before);
  });

  it("keeps a required migration blocked until a receipt is present", () => {
    const handoff = fixture();
    expect(
      codes({
        schemaVersion: 1,
        fileUpgrade: {
          planFingerprint: `sha256:${"1".repeat(64)}`,
          dataMigrationRequired: true,
        },
        migration: {
          expectedFingerprint: fingerprintFor(handoff),
          handoff,
        },
      }),
    ).toEqual(["MIGRATION_VERIFY_RECEIPT_REQUIRED"]);
  });

  it("accepts only a matching authorized receipt without mutating input", () => {
    const handoff = fixture();
    const candidate = {
      schemaVersion: 1,
      fileUpgrade: {
        planFingerprint: `sha256:${"1".repeat(64)}`,
        dataMigrationRequired: true,
      },
      migration: {
        expectedFingerprint: fingerprintFor(handoff),
        handoff: { ...handoff, receipt: receiptFor(handoff) },
      },
    };
    const before = JSON.stringify(candidate);
    const first = verifyMigrationHandoff(candidate);
    const second = verifyMigrationHandoff({
      migration: candidate.migration,
      fileUpgrade: candidate.fileUpgrade,
      schemaVersion: 1,
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      receiptVerified: true,
      migration: {
        required: true,
        receiptId: "receipt-backfill-workflow-graph-v2",
      },
    });
    expect(JSON.stringify(candidate)).toBe(before);
  });

  it("rejects a stale expected fingerprint", () => {
    const handoff = fixture();
    expect(
      codes({
        schemaVersion: 1,
        fileUpgrade: {
          planFingerprint: `sha256:${"1".repeat(64)}`,
          dataMigrationRequired: true,
        },
        migration: {
          expectedFingerprint: `sha256:${"0".repeat(64)}`,
          handoff: { ...handoff, receipt: receiptFor(handoff) },
        },
      }),
    ).toEqual(["MIGRATION_VERIFY_FINGERPRINT_MISMATCH"]);
  });

  it("rejects stale, tampered, or unauthorized handoff receipts", () => {
    const handoff = fixture();
    const receipt = receiptFor(handoff);
    const base = {
      schemaVersion: 1,
      fileUpgrade: {
        planFingerprint: `sha256:${"1".repeat(64)}`,
        dataMigrationRequired: true,
      },
      migration: { expectedFingerprint: fingerprintFor(handoff), handoff },
    };
    for (const invalidReceipt of [
      { ...receipt, migrationFingerprint: `sha256:${"0".repeat(64)}` },
      {
        ...receipt,
        migrateCounts: { ...receipt.migrateCounts, succeeded: 8 },
      },
      {
        ...receipt,
        authorization: { ...receipt.authorization, approved: false },
      },
    ]) {
      expect(
        codes({
          ...base,
          migration: {
            ...base.migration,
            handoff: { ...handoff, receipt: invalidReceipt },
          },
        }),
      ).toEqual(["MIGRATION_VERIFY_HANDOFF_INVALID"]);
    }
  });

  it("rejects unknown fields and irrelevant migration payloads", () => {
    const clean = {
      schemaVersion: 1,
      fileUpgrade: {
        planFingerprint: `sha256:${"1".repeat(64)}`,
        dataMigrationRequired: false,
      },
    };
    expect(codes({ ...clean, execute: true })).toEqual([
      "MIGRATION_VERIFY_INPUT_INVALID",
    ]);
    expect(codes({ ...clean, migration: { unexpected: true } })).toEqual([
      "MIGRATION_VERIFY_INPUT_INVALID",
    ]);
  });
});
