import { describe, expect, it } from "vitest";
import { verifyMigrationHandoff } from "./verify.js";

const fingerprint = `sha256:${"1".repeat(64)}`;

describe("migration receipt verification bridge", () => {
  it("never trusts caller claims that no migration is required", () => {
    expect(
      verifyMigrationHandoff({
        schemaVersion: 1,
        fileUpgrade: {
          planFingerprint: fingerprint,
          dataMigrationRequired: false,
        },
      }),
    ).toMatchObject({
      ok: false,
      mode: "verify-only",
      writeAvailable: false,
      resolutions: [{ code: "MIGRATION_VERIFY_TRUSTED_AUTHORITY_REQUIRED" }],
    });
  });

  it("never trusts caller fingerprints, handoffs, keys, or replay state", () => {
    const candidate = {
      schemaVersion: 1,
      fileUpgrade: {
        planFingerprint: fingerprint,
        dataMigrationRequired: true,
      },
      migration: {
        expectedFingerprint: fingerprint,
        handoff: {
          receiptAuthority: {
            publicKeyPem: "caller-key",
            consumedReplayIdentities: [],
          },
        },
      },
    };
    const first = verifyMigrationHandoff(candidate);
    const second = verifyMigrationHandoff(candidate);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: false,
      resolutions: [{ code: "MIGRATION_VERIFY_TRUSTED_AUTHORITY_REQUIRED" }],
    });
  });

  it("rejects malformed envelopes without disclosing a trusted result", () => {
    expect(verifyMigrationHandoff({ execute: true })).toMatchObject({
      ok: false,
      resolutions: [{ code: "MIGRATION_VERIFY_INPUT_INVALID" }],
    });
  });
});
