import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalMaterialityDigest,
  canonicalReleasePacketDigest,
  REQUIRED_BUILDKITE_KEYS,
  REQUIRED_RECEIPT_CHECKS,
  validateReleaseEvidence,
} from "../src/release-evidence-check.mjs";

type JsonRecord = Record<string, unknown>;

const roots: string[] = [];
const sha = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const object = (value: unknown): JsonRecord => value as JsonRecord;

const receipt = (
  name: keyof typeof REQUIRED_RECEIPT_CHECKS,
  releaseCommit: string,
  extra: JsonRecord = {},
): JsonRecord => ({
  checks: [...REQUIRED_RECEIPT_CHECKS[name]],
  evidenceSha256: sha(name[0] ?? "a"),
  receiptId: `${name}-receipt`,
  releaseCommit,
  status: "passed",
  ...extra,
});

const packet = (releaseCommit: string): JsonRecord => {
  const goApprovedAt = "2026-07-10T12:00:00.000Z";
  const buildId = "build-123";
  const deployId = "deploy-123";
  const result: JsonRecord = {
    approvers: ["release-owner", "security-owner"],
    attestationCommit: releaseCommit,
    buildId,
    capacityReceipt: receipt("capacityReceipt", releaseCommit, {
      admittedEventLoss: 0,
      agencyCount: 2,
      burstEventsPerSecond: 20,
      burstSeconds: 60,
      channelCount: 100,
      clientBrainCount: 25,
      concurrentRequests: 10,
      crossTenantEffects: 0,
      drainedWithinFiveMinutes: true,
      liveVisibleWithin60SecondsRate: 0.95,
      revisionCount: 100_000,
    }),
    ciContext: {
      buildId,
      checks: REQUIRED_BUILDKITE_KEYS.map((key) => ({
        buildId,
        completedAt: key.startsWith("production-")
          ? "2026-07-10T12:10:00.000Z"
          : "2026-07-09T12:00:00.000Z",
        context: `buildkite/${key}`,
        key,
        releaseCommit,
        status: "passed",
        url: `https://buildkite.example.test/builds/123#${key}`,
      })),
      releaseCommit,
      status: "passed",
    },
    deployId,
    evalReceipt: receipt("evalReceipt", releaseCommit, {
      modelSha256: sha("1"),
      promptSha256: sha("2"),
      toolSchemaSha256: sha("3"),
      zeroTolerancePassed: true,
    }),
    goApprovedAt,
    headlessReceipt: receipt("headlessReceipt", releaseCommit, {
      claudeCodeRemoteConnectionId: "claude-code-remote-1",
      operationCount: 7,
    }),
    incidents: [],
    inheritedEvidence: { inherited: false },
    lifecycleReceipt: receipt("lifecycleReceipt", releaseCommit),
    manifestHashes: {
      dependency: sha("4"),
      environment: sha("5"),
      generated: sha("6"),
      migrationSet: sha("7"),
      providerPolicy: sha("8"),
      slackManifest: sha("9"),
    },
    migrationReceipt: receipt("migrationReceipt", releaseCommit, {
      batchSize: 100,
      changed: 800,
      childReceiptSha256s: [sha("a"), sha("b")],
      complete: true,
      countProvenance: "migration-run-parent-1",
      cursor: "complete",
      failed: 0,
      finishedAt: "2026-07-01T01:00:00.000Z",
      migrationName: "maestro-brain-v1",
      mode: "expand-backfill-cutover",
      observationEndsAt: "2026-08-01T00:00:00.000Z",
      parityChecks: ["counts", "uniqueness", "old-new-read-parity"],
      rollbackOwner: "release-owner",
      scanned: 1_000,
      schemaAfter: "schema-v2",
      schemaBefore: "schema-v1",
      skipped: 200,
      startedAt: "2026-07-01T00:00:00.000Z",
    }),
    pilot: {
      activatedAgencyCount: 4,
      activatedSecondSurface: { denominator: 4, numerator: 3 },
      activeClientWeeks: 12,
      adminMinutesMedian: 9.9,
      briefAccepted: { denominator: 6, numerator: 5 },
      citedAnswerUseful: { denominator: 6, numerator: 5 },
      completedAgencyCount: 6,
      endedAt: "2026-07-08T00:00:00.000Z",
      enrolledAgencyCount: 6,
      frozenCohortSha256: sha("c"),
      manualMaintenanceActions: 23,
      missingDataTreatment: "count-as-failure",
      secondSurface: { denominator: 6, numerator: 3 },
      spendUsd: 123.45,
      startedAt: "2026-07-01T00:00:00.000Z",
      timeToValueMinutesMedian: 14.9,
      zeroActionWeeksIncluded: true,
    },
    productReleaseCommit: releaseCommit,
    promotionReceipt: receipt("promotionReceipt", releaseCommit, {
      buildId,
      completedAt: "2026-07-10T12:15:00.000Z",
      deployId,
    }),
    providerReceipt: receipt("providerReceipt", releaseCommit, {
      distributionMode: "marketplace",
      fastHistoryPromise: true,
      historyRepliesRateClass: "tier-3",
      publishedCatchUpWindow: null,
      rateQualification: "tier-3-or-equivalent",
    }),
    reviewVerdict: "go",
    rollbackReceipt: {
      compatibleBinaryRestore: true,
      deployId,
      destructiveReverseMigration: false,
      evidenceSha256: sha("d"),
      monotonicLifecyclePreserved: true,
      previousReleaseCommit: "e".repeat(40),
      reconciledForward: true,
      releaseCommit,
      reverseMigrationIds: [],
      rollbackId: "rollback-deploy-122",
      rollbackOwner: "release-owner",
      rollForwardId: "roll-forward-deploy-123",
      status: "passed",
    },
    schemaVersion: "maestro-brain-release-evidence/v1",
    signatureSha256: "",
    stagingReceipt: receipt("stagingReceipt", releaseCommit),
    status: "launch_approved",
  };
  result.signatureSha256 = canonicalReleasePacketDigest(result);
  return result;
};

const fixture = () => {
  const evidenceDirectory = mkdtempSync(
    resolve(tmpdir(), "brain-release-evidence-"),
  );
  roots.push(evidenceDirectory);
  const releaseCommit = "f".repeat(40);
  const path = resolve(evidenceDirectory, "release", "release-result.json");
  mkdirSync(resolve(evidenceDirectory, "release"));
  const result = packet(releaseCommit);
  const write = (resign = true) => {
    if (resign) result.signatureSha256 = canonicalReleasePacketDigest(result);
    writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
  };
  write();
  return { evidenceDirectory, releaseCommit, result, write };
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("release evidence gate", () => {
  it("accepts the canonical S14-T01 packet", () => {
    const value = fixture();
    expect(() => validateReleaseEvidence(value)).not.toThrow();
  });

  it("requires the exact authoritative Buildkite key and context set", () => {
    const value = fixture();
    const checks = object(value.result.ciContext).checks as JsonRecord[];
    checks.pop();
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/exact required set/);
  });

  it("rejects a mirrored, stale, or pre-go production context", () => {
    const value = fixture();
    const checks = object(value.result.ciContext).checks as JsonRecord[];
    const production = checks.find(
      (check) => check.key === "production-promote",
    );
    expect(production).toBeDefined();
    if (!production) return;
    production.context = "github/production-promote";
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/not authoritative/);
    production.context = "buildkite/production-promote";
    production.releaseCommit = "0".repeat(40);
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/not authoritative/);
    production.releaseCommit = value.releaseCommit;
    production.completedAt = "2026-07-10T11:59:59.999Z";
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/signed go decision/);
  });

  it.each(Object.keys(REQUIRED_RECEIPT_CHECKS))(
    "requires %s to bind the product release commit",
    (field) => {
      const value = fixture();
      object(value.result[field]).releaseCommit = "0".repeat(40);
      value.write();
      expect(() => validateReleaseEvidence(value)).toThrow(
        `${field} does not bind releaseCommit`,
      );
    },
  );

  it("recomputes ceiling-rounded full-cohort pilot thresholds", () => {
    const value = fixture();
    const pilot = object(value.result.pilot);
    object(pilot.briefAccepted).numerator = 4;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/ceiling-rounded/);
    object(pilot.briefAccepted).numerator = 5;
    object(pilot.citedAnswerUseful).numerator = 4;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/ceiling-rounded/);
    object(pilot.citedAnswerUseful).numerator = 5;
    object(pilot.secondSurface).numerator = 2;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/ceiling-rounded/);
  });

  it("rejects denominator shrinkage, shortened observation, and missing-data exclusion", () => {
    const value = fixture();
    const pilot = object(value.result.pilot);
    object(pilot.briefAccepted).denominator = 5;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/denominator/);
    object(pilot.briefAccepted).denominator = 6;
    pilot.endedAt = "2026-07-07T23:59:59.999Z";
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/seven full days/);
    pilot.endedAt = "2026-07-08T00:00:00.000Z";
    pilot.missingDataTreatment = "exclude-nonresponse";
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/count as failure/);
  });

  it("enforces strict time, admin, and active-client-week thresholds", () => {
    const value = fixture();
    const pilot = object(value.result.pilot);
    pilot.timeToValueMinutesMedian = 15;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/time-to-value/);
    pilot.timeToValueMinutesMedian = 14.9;
    pilot.adminMinutesMedian = 10;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/admin-time/);
    pilot.adminMinutesMedian = 9.9;
    pilot.manualMaintenanceActions = 24;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/maintenance/);
    pilot.manualMaintenanceActions = 23;
    pilot.zeroActionWeeksIncluded = false;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/maintenance/);
  });

  it("requires compatible rollback and distinct rollback/roll-forward IDs", () => {
    const value = fixture();
    const rollback = object(value.result.rollbackReceipt);
    rollback.destructiveReverseMigration = true;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/destructive/);
    rollback.destructiveReverseMigration = false;
    rollback.rollForwardId = rollback.rollbackId;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/IDs must differ/);
    rollback.rollForwardId = "roll-forward-deploy-123";
    rollback.reverseMigrationIds = ["down-migration"];
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/rollback protocol/);
  });

  it("requires signed docs-only materiality when attestation differs", () => {
    const value = fixture();
    const attestationCommit = "1".repeat(40);
    value.result.attestationCommit = attestationCommit;
    const inheritance: JsonRecord = {
      approvers: [...(value.result.approvers as string[])],
      attestationCommit,
      changedFiles: ["docs/superpowers/receipts/release.md"],
      docsOnly: true,
      inherited: true,
      newPacketSha256: sha("2"),
      oldPacketSha256: sha("1"),
      productReleaseCommit: value.releaseCommit,
      signatureSha256: "",
      unaffectedEvidence: [
        ...Object.keys(REQUIRED_RECEIPT_CHECKS),
        ...REQUIRED_BUILDKITE_KEYS,
      ],
    };
    inheritance.signatureSha256 = canonicalMaterialityDigest(inheritance);
    value.result.inheritedEvidence = inheritance;
    value.write();
    expect(() => validateReleaseEvidence(value)).not.toThrow();
    object(value.result.inheritedEvidence).changedFiles = ["package.json"];
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/not docs-only/);
    object(value.result.inheritedEvidence).changedFiles = [
      "docs/superpowers/receipts/release.md",
    ];
    object(value.result.inheritedEvidence).signatureSha256 = sha("stale");
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(
      /materiality record canonical digest mismatch/,
    );
  });

  it("rejects unqualified fast history and drifted frozen capacity", () => {
    const value = fixture();
    const provider = object(value.result.providerReceipt);
    provider.rateQualification = "tier-2";
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/Tier 3/);
    provider.rateQualification = "tier-3-or-equivalent";
    object(value.result.capacityReceipt).channelCount = 99;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(
      /frozen launch fixture/,
    );
  });

  it("rejects incomplete migration, headless, eval, and promotion receipts", () => {
    const value = fixture();
    object(value.result.migrationReceipt).failed = 1;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/failed rows/);
    object(value.result.migrationReceipt).failed = 0;
    object(value.result.headlessReceipt).operationCount = 6;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/seven-operation/);
    object(value.result.headlessReceipt).operationCount = 7;
    object(value.result.evalReceipt).zeroTolerancePassed = false;
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/zero-tolerance/);
    object(value.result.evalReceipt).zeroTolerancePassed = true;
    object(value.result.promotionReceipt).deployId = "different-deploy";
    value.write();
    expect(() => validateReleaseEvidence(value)).toThrow(/not bound/);
  });

  it("recomputes the canonical packet digest", () => {
    const value = fixture();
    object(value.result.pilot).spendUsd = 999;
    value.write(false);
    expect(() => validateReleaseEvidence(value)).toThrow(/digest mismatch/);
  });
});
