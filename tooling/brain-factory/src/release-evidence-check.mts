import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

type JsonRecord = Record<string, unknown>;

export const REQUIRED_BUILDKITE_KEYS = [
  "ci-self-protection",
  "contract-review",
  "eval-artifacts",
  "mutation",
  "phase-1",
  "production-approval",
  "production-promote",
  "staging-deploy",
  "taste",
] as const;

export const REQUIRED_RECEIPT_CHECKS = {
  capacityReceipt: [
    "100-channels",
    "100k-revisions",
    "burst",
    "concurrency",
    "drain",
    "fairness",
    "live-slo",
    "pressure",
    "tenancy",
    "zero-loss",
  ],
  evalReceipt: [
    "answer-entailment",
    "classification",
    "maintenance",
    "multilingual-paraphrase",
    "prompt-injection",
    "restore-replay",
  ],
  headlessReceipt: [
    "claude-code-remote",
    "expired-key",
    "origin",
    "protocol",
    "rate-limit",
    "revoked-key",
    "schema-hash-parity",
    "seven-operation-allowlist",
    "timeout",
  ],
  lifecycleReceipt: [
    "backup-restore-canary",
    "compatible-binary-rollback",
    "descendant-receipts",
    "kill-switches",
    "monotonic-revocation",
    "post-s12-trigger-matrix",
    "roll-forward",
  ],
  migrationReceipt: [
    "backfill",
    "compatible-write",
    "dry-run",
    "expand",
    "observation-window",
    "read-cutover",
    "verify",
    "write-cutover",
  ],
  promotionReceipt: [
    "cohort-enable",
    "production-doctor",
    "production-promote",
  ],
  providerReceipt: [
    "app-remove-readd",
    "distribution-mode",
    "edit-delete",
    "history-replies-rate-class",
    "multi-channel-deep",
    "multi-channel-live",
    "multi-channel-recent",
    "nango-connect",
    "nango-reconnect",
    "private-reply",
    "rate-limit-429",
    "slack-connect-no-send",
    "slack-manifest",
  ],
  stagingReceipt: [
    "deploy-doctor-negative",
    "deploy-doctor-restored",
    "hosted-a11y",
    "hosted-auth",
    "hosted-browser",
    "hosted-http",
    "hosted-visual",
    "isolated-backend",
    "staging-deploy",
    "synthetic-isolation-security",
  ],
} as const;

const TOP_LEVEL_KEYS = [
  "approvers",
  "attestationCommit",
  "buildId",
  "capacityReceipt",
  "ciContext",
  "deployId",
  "evalReceipt",
  "goApprovedAt",
  "headlessReceipt",
  "incidents",
  "inheritedEvidence",
  "lifecycleReceipt",
  "manifestHashes",
  "migrationReceipt",
  "pilot",
  "productReleaseCommit",
  "promotionReceipt",
  "providerReceipt",
  "reviewVerdict",
  "rollbackReceipt",
  "schemaVersion",
  "signatureSha256",
  "stagingReceipt",
  "status",
] as const;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const record = (value: unknown, label: string): JsonRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

const exactSha = (value: unknown, label: string, length: 40 | 64): string => {
  const result = string(value, label);
  if (!new RegExp(`^[0-9a-f]{${length}}$`).test(result)) {
    throw new Error(`${label} must be an exact ${length}-character SHA`);
  }
  return result;
};

const finiteNumber = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
};

const nonnegativeInteger = (value: unknown, label: string): number => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
  }
  return Number(value);
};

const isoTimestamp = (value: unknown, label: string): number => {
  const timestamp = string(value, label);
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString() !== timestamp) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return parsed;
};

const exactKeys = (
  value: JsonRecord,
  expected: readonly string[],
  label: string,
): void => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(canonical)) {
    throw new Error(`${label} fields do not match the canonical packet`);
  }
};

const exactStringSet = (
  value: unknown,
  expected: readonly string[],
  label: string,
): void => {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string") ||
    new Set(value).size !== value.length ||
    JSON.stringify([...value].sort()) !== JSON.stringify([...expected].sort())
  ) {
    throw new Error(`${label} does not contain the exact required set`);
  }
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("release packet contains a non-finite number");
  }
  return value;
};

const canonicalDigestWithoutSignature = (value: unknown): string => {
  const packet = { ...record(value, "release packet") };
  delete packet.signatureSha256;
  return sha256(JSON.stringify(canonicalize(packet)));
};

export const canonicalReleasePacketDigest = (value: unknown): string =>
  canonicalDigestWithoutSignature(value);

export const canonicalMaterialityDigest = (value: unknown): string =>
  canonicalDigestWithoutSignature(value);

const commonReceipt = (
  value: unknown,
  label: keyof typeof REQUIRED_RECEIPT_CHECKS,
  releaseCommit: string,
): JsonRecord => {
  const receipt = record(value, label);
  if (receipt.status !== "passed") throw new Error(`${label} is not passed`);
  if (receipt.releaseCommit !== releaseCommit) {
    throw new Error(`${label} does not bind releaseCommit`);
  }
  string(receipt.receiptId, `${label}.receiptId`);
  exactSha(receipt.evidenceSha256, `${label}.evidenceSha256`, 64);
  exactStringSet(
    receipt.checks,
    REQUIRED_RECEIPT_CHECKS[label],
    `${label}.checks`,
  );
  return receipt;
};

const validateBuildkite = (
  value: unknown,
  releaseCommit: string,
  buildId: string,
  goApprovedAt: number,
): void => {
  const context = record(value, "ciContext");
  exactKeys(
    context,
    ["buildId", "checks", "releaseCommit", "status"],
    "ciContext",
  );
  if (
    context.status !== "passed" ||
    context.releaseCommit !== releaseCommit ||
    context.buildId !== buildId ||
    !Array.isArray(context.checks)
  ) {
    throw new Error(
      "ciContext is not a passed release-bound Buildkite context",
    );
  }
  const keys: string[] = [];
  for (const [index, raw] of context.checks.entries()) {
    const check = record(raw, `ciContext.checks[${index}]`);
    exactKeys(
      check,
      [
        "buildId",
        "completedAt",
        "context",
        "key",
        "releaseCommit",
        "status",
        "url",
      ],
      `ciContext.checks[${index}]`,
    );
    const key = string(check.key, `ciContext.checks[${index}].key`);
    keys.push(key);
    if (
      check.context !== `buildkite/${key}` ||
      check.status !== "passed" ||
      check.releaseCommit !== releaseCommit ||
      check.buildId !== buildId ||
      !/^https:\/\//.test(string(check.url, `${key}.url`))
    ) {
      throw new Error(`${key}: Buildkite context is not authoritative`);
    }
    const completedAt = isoTimestamp(check.completedAt, `${key}.completedAt`);
    if (
      new Set(["production-approval", "production-promote"]).has(key) &&
      completedAt < goApprovedAt
    ) {
      throw new Error(`${key}: completed before the signed go decision`);
    }
  }
  exactStringSet(keys, REQUIRED_BUILDKITE_KEYS, "Buildkite keys");
};

const validatePilot = (value: unknown): void => {
  const pilot = record(value, "pilot");
  exactKeys(
    pilot,
    [
      "activatedAgencyCount",
      "activatedSecondSurface",
      "activeClientWeeks",
      "adminMinutesMedian",
      "briefAccepted",
      "citedAnswerUseful",
      "completedAgencyCount",
      "endedAt",
      "enrolledAgencyCount",
      "frozenCohortSha256",
      "manualMaintenanceActions",
      "missingDataTreatment",
      "secondSurface",
      "spendUsd",
      "startedAt",
      "timeToValueMinutesMedian",
      "zeroActionWeeksIncluded",
    ],
    "pilot",
  );
  const enrolled = nonnegativeInteger(
    pilot.enrolledAgencyCount,
    "pilot.enrolledAgencyCount",
  );
  const completed = nonnegativeInteger(
    pilot.completedAgencyCount,
    "pilot.completedAgencyCount",
  );
  if (completed < 5 || enrolled < completed) {
    throw new Error(
      "pilot denominator must contain at least five completed agencies",
    );
  }
  const startedAt = isoTimestamp(pilot.startedAt, "pilot.startedAt");
  const endedAt = isoTimestamp(pilot.endedAt, "pilot.endedAt");
  if (endedAt - startedAt < 7 * 24 * 60 * 60 * 1000) {
    throw new Error("pilot does not prove seven full days");
  }
  if (pilot.missingDataTreatment !== "count-as-failure") {
    throw new Error("pilot missing data must count as failure");
  }
  exactSha(pilot.frozenCohortSha256, "pilot.frozenCohortSha256", 64);
  const metric = (
    field: "briefAccepted" | "citedAnswerUseful" | "secondSurface",
    threshold: number,
  ): void => {
    const value = record(pilot[field], `pilot.${field}`);
    exactKeys(value, ["denominator", "numerator"], `pilot.${field}`);
    const denominator = nonnegativeInteger(
      value.denominator,
      `pilot.${field}.denominator`,
    );
    const numerator = nonnegativeInteger(
      value.numerator,
      `pilot.${field}.numerator`,
    );
    if (denominator !== completed || numerator > denominator) {
      throw new Error(`pilot.${field} denominator is invalid`);
    }
    if (numerator < Math.ceil(threshold * denominator)) {
      throw new Error(`pilot.${field} fails its ceiling-rounded threshold`);
    }
  };
  metric("briefAccepted", 0.8);
  metric("citedAnswerUseful", 0.7);
  metric("secondSurface", 0.5);
  const activated = nonnegativeInteger(
    pilot.activatedAgencyCount,
    "pilot.activatedAgencyCount",
  );
  const activatedSecondSurface = record(
    pilot.activatedSecondSurface,
    "pilot.activatedSecondSurface",
  );
  exactKeys(
    activatedSecondSurface,
    ["denominator", "numerator"],
    "pilot.activatedSecondSurface",
  );
  const activatedDenominator = nonnegativeInteger(
    activatedSecondSurface.denominator,
    "pilot.activatedSecondSurface.denominator",
  );
  const activatedNumerator = nonnegativeInteger(
    activatedSecondSurface.numerator,
    "pilot.activatedSecondSurface.numerator",
  );
  if (
    activated > completed ||
    activatedDenominator !== activated ||
    activatedNumerator > activated
  ) {
    throw new Error("pilot activated-agency denominator is invalid");
  }
  if (
    finiteNumber(
      pilot.timeToValueMinutesMedian,
      "pilot.timeToValueMinutesMedian",
    ) < 0 ||
    Number(pilot.timeToValueMinutesMedian) >= 15 ||
    finiteNumber(pilot.adminMinutesMedian, "pilot.adminMinutesMedian") < 0 ||
    Number(pilot.adminMinutesMedian) >= 10
  ) {
    throw new Error("pilot time-to-value or admin-time threshold failed");
  }
  const activeClientWeeks = nonnegativeInteger(
    pilot.activeClientWeeks,
    "pilot.activeClientWeeks",
  );
  const manualActions = nonnegativeInteger(
    pilot.manualMaintenanceActions,
    "pilot.manualMaintenanceActions",
  );
  if (
    activeClientWeeks === 0 ||
    pilot.zeroActionWeeksIncluded !== true ||
    manualActions / activeClientWeeks >= 2
  ) {
    throw new Error("pilot maintenance denominator or threshold failed");
  }
  if (finiteNumber(pilot.spendUsd, "pilot.spendUsd") < 0) {
    throw new Error("pilot spend must be nonnegative");
  }
};

const validateMigration = (receipt: JsonRecord): void => {
  if (
    receipt.complete !== true ||
    nonnegativeInteger(receipt.failed, "migrationReceipt.failed") !== 0
  ) {
    throw new Error("migrationReceipt is incomplete or has failed rows");
  }
  for (const field of ["scanned", "batchSize"]) {
    nonnegativeInteger(receipt[field], `migrationReceipt.${field}`);
  }
  for (const field of ["changed", "skipped"]) {
    if (receipt[field] !== null) {
      nonnegativeInteger(receipt[field], `migrationReceipt.${field}`);
    }
  }
  for (const field of [
    "migrationName",
    "schemaBefore",
    "schemaAfter",
    "cursor",
  ]) {
    string(receipt[field], `migrationReceipt.${field}`);
  }
  if (receipt.mode !== "expand-backfill-cutover") {
    throw new Error("migrationReceipt mode is not rollback-compatible");
  }
  if (
    !Array.isArray(receipt.childReceiptSha256s) ||
    receipt.childReceiptSha256s.length === 0 ||
    new Set(receipt.childReceiptSha256s).size !==
      receipt.childReceiptSha256s.length
  ) {
    throw new Error("migrationReceipt child receipt chain is incomplete");
  }
  for (const [index, child] of receipt.childReceiptSha256s.entries()) {
    exactSha(child, `migrationReceipt.childReceiptSha256s[${index}]`, 64);
  }
  string(receipt.countProvenance, "migrationReceipt.countProvenance");
  if (
    !Array.isArray(receipt.parityChecks) ||
    receipt.parityChecks.length === 0 ||
    receipt.parityChecks.some(
      (check) => typeof check !== "string" || check.trim() === "",
    )
  ) {
    throw new Error("migrationReceipt parity checks are missing");
  }
  string(receipt.rollbackOwner, "migrationReceipt.rollbackOwner");
  const finishedAt = isoTimestamp(
    receipt.finishedAt,
    "migrationReceipt.finishedAt",
  );
  if (
    isoTimestamp(receipt.startedAt, "migrationReceipt.startedAt") >=
      finishedAt ||
    isoTimestamp(
      receipt.observationEndsAt,
      "migrationReceipt.observationEndsAt",
    ) <= finishedAt
  ) {
    throw new Error("migrationReceipt timestamps are invalid");
  }
};

const validateProvider = (receipt: JsonRecord): void => {
  string(receipt.distributionMode, "providerReceipt.distributionMode");
  string(
    receipt.historyRepliesRateClass,
    "providerReceipt.historyRepliesRateClass",
  );
  if (typeof receipt.fastHistoryPromise !== "boolean") {
    throw new Error("providerReceipt.fastHistoryPromise must be boolean");
  }
  if (
    receipt.fastHistoryPromise === true &&
    receipt.rateQualification !== "tier-3-or-equivalent"
  ) {
    throw new Error("fast history requires Tier 3 or equivalent qualification");
  }
  if (
    receipt.fastHistoryPromise === false &&
    (typeof receipt.publishedCatchUpWindow !== "string" ||
      receipt.publishedCatchUpWindow.trim() === "")
  ) {
    throw new Error("slower history requires a published catch-up window");
  }
};

const validateCapacity = (receipt: JsonRecord): void => {
  if (
    receipt.agencyCount !== 2 ||
    receipt.clientBrainCount !== 25 ||
    receipt.channelCount !== 100 ||
    receipt.revisionCount !== 100_000 ||
    receipt.burstEventsPerSecond !== 20 ||
    receipt.burstSeconds !== 60 ||
    receipt.concurrentRequests !== 10 ||
    receipt.admittedEventLoss !== 0 ||
    receipt.crossTenantEffects !== 0
  ) {
    throw new Error("capacityReceipt does not bind the frozen launch fixture");
  }
  if (
    finiteNumber(
      receipt.liveVisibleWithin60SecondsRate,
      "capacityReceipt.liveVisibleWithin60SecondsRate",
    ) < 0.95 ||
    receipt.drainedWithinFiveMinutes !== true
  ) {
    throw new Error("capacityReceipt fails the launch SLO");
  }
};

const validateEval = (receipt: JsonRecord): void => {
  for (const field of ["modelSha256", "promptSha256", "toolSchemaSha256"]) {
    exactSha(receipt[field], `evalReceipt.${field}`, 64);
  }
  if (receipt.zeroTolerancePassed !== true) {
    throw new Error("evalReceipt has a zero-tolerance failure");
  }
};

const validateRollback = (
  value: unknown,
  releaseCommit: string,
  deployId: string,
): void => {
  const receipt = record(value, "rollbackReceipt");
  if (
    receipt.status !== "passed" ||
    receipt.releaseCommit !== releaseCommit ||
    receipt.deployId !== deployId ||
    receipt.destructiveReverseMigration !== false
  ) {
    throw new Error("rollbackReceipt is missing, unbound, or destructive");
  }
  const previous = exactSha(
    receipt.previousReleaseCommit,
    "rollbackReceipt.previousReleaseCommit",
    40,
  );
  if (previous === releaseCommit) {
    throw new Error("rollbackReceipt has no previous compatible release");
  }
  const rollbackId = string(receipt.rollbackId, "rollbackReceipt.rollbackId");
  const rollForwardId = string(
    receipt.rollForwardId,
    "rollbackReceipt.rollForwardId",
  );
  if (rollbackId === rollForwardId) {
    throw new Error("rollback and roll-forward IDs must differ");
  }
  string(receipt.rollbackOwner, "rollbackReceipt.rollbackOwner");
  if (
    !Array.isArray(receipt.reverseMigrationIds) ||
    receipt.reverseMigrationIds.length !== 0 ||
    receipt.compatibleBinaryRestore !== true ||
    receipt.reconciledForward !== true ||
    receipt.monotonicLifecyclePreserved !== true
  ) {
    throw new Error(
      "rollbackReceipt violates the compatible rollback protocol",
    );
  }
  exactSha(receipt.evidenceSha256, "rollbackReceipt.evidenceSha256", 64);
};

const validateInheritance = (
  value: unknown,
  productReleaseCommit: string,
  attestationCommit: string,
  approvers: readonly string[],
): void => {
  const inheritance = record(value, "inheritedEvidence");
  if (attestationCommit === productReleaseCommit) {
    exactKeys(inheritance, ["inherited"], "inheritedEvidence");
    if (inheritance.inherited !== false) {
      throw new Error("same-commit release must not claim inherited evidence");
    }
    return;
  }
  exactKeys(
    inheritance,
    [
      "approvers",
      "attestationCommit",
      "changedFiles",
      "docsOnly",
      "inherited",
      "newPacketSha256",
      "oldPacketSha256",
      "productReleaseCommit",
      "signatureSha256",
      "unaffectedEvidence",
    ],
    "inheritedEvidence",
  );
  if (
    inheritance.inherited !== true ||
    inheritance.docsOnly !== true ||
    inheritance.productReleaseCommit !== productReleaseCommit ||
    inheritance.attestationCommit !== attestationCommit
  ) {
    throw new Error("materiality record does not bind the two commits");
  }
  if (
    !Array.isArray(inheritance.changedFiles) ||
    inheritance.changedFiles.length === 0 ||
    new Set(inheritance.changedFiles).size !==
      inheritance.changedFiles.length ||
    inheritance.changedFiles.some(
      (file) =>
        typeof file !== "string" ||
        !/^docs\/(?!\.\.(?:\/|$))(?!.*\/\.\.(?:\/|$))/.test(file),
    )
  ) {
    throw new Error("materiality inheritance is not docs-only");
  }
  exactStringSet(inheritance.approvers, approvers, "materiality approvers");
  exactStringSet(
    inheritance.unaffectedEvidence,
    [...Object.keys(REQUIRED_RECEIPT_CHECKS), ...REQUIRED_BUILDKITE_KEYS],
    "materiality unaffected evidence",
  );
  const oldHash = exactSha(
    inheritance.oldPacketSha256,
    "inheritedEvidence.oldPacketSha256",
    64,
  );
  const newHash = exactSha(
    inheritance.newPacketSha256,
    "inheritedEvidence.newPacketSha256",
    64,
  );
  if (oldHash === newHash) {
    throw new Error("materiality record does not identify a changed packet");
  }
  const materialitySignature = exactSha(
    inheritance.signatureSha256,
    "inheritedEvidence.signatureSha256",
    64,
  );
  if (materialitySignature !== canonicalMaterialityDigest(inheritance)) {
    throw new Error("materiality record canonical digest mismatch");
  }
};

export const validateReleaseEvidence = (input: {
  readonly evidenceDirectory: string;
  readonly releaseCommit: string;
}): void => {
  if (!isAbsolute(input.evidenceDirectory)) {
    throw new Error("release evidence directory must be absolute");
  }
  const releaseCommit = exactSha(input.releaseCommit, "release commit", 40);
  const path = resolve(
    input.evidenceDirectory,
    "release",
    "release-result.json",
  );
  const result = record(JSON.parse(readFileSync(path, "utf8")), path);
  exactKeys(result, TOP_LEVEL_KEYS, "release packet");
  if (result.schemaVersion !== "maestro-brain-release-evidence/v1") {
    throw new Error("unexpected release evidence schema");
  }
  if (result.productReleaseCommit !== releaseCommit) {
    throw new Error("release evidence does not bind the frozen commit");
  }
  const attestationCommit = exactSha(
    result.attestationCommit,
    "attestationCommit",
    40,
  );
  if (result.status !== "launch_approved" || result.reviewVerdict !== "go") {
    throw new Error("release evidence has no deterministic go verdict");
  }
  const buildId = string(result.buildId, "buildId");
  const deployId = string(result.deployId, "deployId");
  const goApprovedAt = isoTimestamp(result.goApprovedAt, "goApprovedAt");
  if (
    !Array.isArray(result.approvers) ||
    result.approvers.length < 2 ||
    new Set(result.approvers).size !== result.approvers.length ||
    result.approvers.some(
      (approver) => typeof approver !== "string" || approver.trim() === "",
    )
  ) {
    throw new Error("release requires two unique named approver aliases");
  }
  const approvers = result.approvers as string[];
  validateBuildkite(result.ciContext, releaseCommit, buildId, goApprovedAt);
  const receipts = Object.fromEntries(
    Object.keys(REQUIRED_RECEIPT_CHECKS).map((label) => [
      label,
      commonReceipt(
        result[label],
        label as keyof typeof REQUIRED_RECEIPT_CHECKS,
        releaseCommit,
      ),
    ]),
  ) as Record<keyof typeof REQUIRED_RECEIPT_CHECKS, JsonRecord>;
  validateProvider(receipts.providerReceipt);
  if (receipts.headlessReceipt.operationCount !== 7) {
    throw new Error(
      "headlessReceipt does not prove the seven-operation remote MCP surface",
    );
  }
  string(
    receipts.headlessReceipt.claudeCodeRemoteConnectionId,
    "headlessReceipt.claudeCodeRemoteConnectionId",
  );
  validateMigration(receipts.migrationReceipt);
  validateEval(receipts.evalReceipt);
  validateCapacity(receipts.capacityReceipt);
  if (
    receipts.promotionReceipt.buildId !== buildId ||
    receipts.promotionReceipt.deployId !== deployId ||
    isoTimestamp(
      receipts.promotionReceipt.completedAt,
      "promotionReceipt.completedAt",
    ) < goApprovedAt
  ) {
    throw new Error(
      "promotionReceipt is not bound after the signed go decision",
    );
  }
  validatePilot(result.pilot);
  validateRollback(result.rollbackReceipt, releaseCommit, deployId);
  const manifestHashes = record(result.manifestHashes, "manifestHashes");
  exactKeys(
    manifestHashes,
    [
      "dependency",
      "environment",
      "generated",
      "migrationSet",
      "providerPolicy",
      "slackManifest",
    ],
    "manifestHashes",
  );
  for (const [key, value] of Object.entries(manifestHashes)) {
    exactSha(value, `manifestHashes.${key}`, 64);
  }
  if (!Array.isArray(result.incidents) || result.incidents.length !== 0) {
    throw new Error("release has a zero-tolerance incident");
  }
  validateInheritance(
    result.inheritedEvidence,
    releaseCommit,
    attestationCommit,
    approvers,
  );
  const signature = exactSha(result.signatureSha256, "signatureSha256", 64);
  if (signature !== canonicalReleasePacketDigest(result)) {
    throw new Error("release packet canonical digest mismatch");
  }
};

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

if (process.argv[1]?.endsWith("release-evidence-check.mts")) {
  const evidenceDirectory = valueAfter("--evidence");
  const releaseCommit = valueAfter("--release-commit");
  if (!evidenceDirectory || !releaseCommit) {
    throw new Error(
      "usage: release-evidence-check --evidence <absolute-path> --release-commit <sha>",
    );
  }
  validateReleaseEvidence({ evidenceDirectory, releaseCommit });
  console.log(`${releaseCommit}: release evidence check passed`);
}
