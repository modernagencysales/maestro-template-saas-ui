import { createHash } from "node:crypto";

const REVIEWED_MANIFEST = {
  schemaVersion: 1,
  transition: {
    id: "template-0.1-to-0.2",
    fromVersion: "0.1.0-alpha.1",
    toVersion: "0.2.0-alpha.1",
    immediatePriorVersion: "0.1.0-alpha.1",
  },
  releaseManifests: {
    from: {
      path: "releases/v0.1.0-alpha.1/manifest.json",
      sha256:
        "sha256:0b55fd0895ecbcf6743860551ed52f165b4252c17ea94ad1687163a8ce6c6b93",
    },
    to: {
      path: "releases/v0.2.0-alpha.1/manifest.json",
      sha256:
        "sha256:532c0da941bce540648b38c4fb868a35b7f37ff9d2623ff5778cd922866168f6",
    },
  },
  handoff: {
    migrationId: "backfill-workflow-graph-v2",
    fixture: {
      path: "tooling/release/__fixtures__/migration/clean.json",
      sha256:
        "sha256:3fb88ae7345884b8e8b74e67b04910770183b5150412cc86bd25f950fe56b9b6",
    },
    planner: {
      path: "tooling/release/src/migration/plan.ts",
      sha256:
        "sha256:7ea892fe29ef1e7339bcc39f4aafaf40680487502f3344c11ffb2a867c01bedd",
    },
  },
  steps: [
    "expand",
    "backward-compatible-code",
    "preview",
    "migrate",
    "compatibility-window",
    "contract",
  ],
  rollback: {
    preUpgradeCommitRequired: true,
    codeDisposition: "reviewed-git-restore",
    dataDisposition: "separate-migration-receipt",
  },
} as const;

export type ReleaseMigrationPlanCode =
  | "RELEASE_MIGRATION_INPUT_INVALID"
  | "RELEASE_MIGRATION_REVIEW_MISMATCH"
  | "RELEASE_MIGRATION_ORIGIN_UNSUPPORTED"
  | "RELEASE_MIGRATION_ORIGIN_HASH_MISMATCH"
  | "RELEASE_MIGRATION_COMPLETION_UNREVIEWED";

export type ReleaseMigrationPlanResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "plan-only";
      readonly executionAvailable: false;
      readonly status: "planned" | "already-applied";
      readonly transitionId: "template-0.1-to-0.2";
      readonly fromVersion: "0.1.0-alpha.1";
      readonly toVersion: "0.2.0-alpha.1";
      readonly migrationId: "backfill-workflow-graph-v2";
      readonly migrationFingerprint: string;
      readonly reviewedHashes: {
        readonly fromReleaseManifest: string;
        readonly toReleaseManifest: string;
        readonly handoffFixture: string;
        readonly handoffPlanner: string;
      };
      readonly steps: typeof REVIEWED_MANIFEST.steps;
      readonly rollback: typeof REVIEWED_MANIFEST.rollback;
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "plan-only";
      readonly executionAvailable: false;
      readonly resolutions: readonly {
        readonly code: ReleaseMigrationPlanCode;
        readonly message: string;
        readonly repair: string;
      }[];
    };

type ParsedInput = {
  readonly manifest: unknown;
  readonly origin: {
    readonly version: string;
    readonly relation:
      "immediate-prior" | "unknown" | "older" | "skipped" | "newer";
    readonly releaseManifestHash: string;
  };
  readonly completedMigrationFingerprints: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const onlyKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => Object.keys(value).every((key) => keys.includes(key));
const text = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value === value.trim() &&
  value === value.normalize("NFC");
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);

const isJsonValue = (value: unknown): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return (
    isRecord(value) && Object.values(value).every((entry) => isJsonValue(entry))
  );
};

const parseInput = (candidate: unknown): ParsedInput | undefined => {
  if (
    !isRecord(candidate) ||
    !onlyKeys(candidate, [
      "schemaVersion",
      "manifest",
      "origin",
      "completedMigrationFingerprints",
    ]) ||
    candidate.schemaVersion !== 1 ||
    !isJsonValue(candidate.manifest) ||
    !isRecord(candidate.origin) ||
    !onlyKeys(candidate.origin, [
      "version",
      "relation",
      "releaseManifestHash",
    ]) ||
    !text(candidate.origin.version) ||
    !["immediate-prior", "unknown", "older", "skipped", "newer"].includes(
      String(candidate.origin.relation),
    ) ||
    !digest(candidate.origin.releaseManifestHash) ||
    !Array.isArray(candidate.completedMigrationFingerprints) ||
    !candidate.completedMigrationFingerprints.every(digest) ||
    new Set(candidate.completedMigrationFingerprints).size !==
      candidate.completedMigrationFingerprints.length
  )
    return undefined;
  return {
    manifest: candidate.manifest,
    origin: {
      version: candidate.origin.version,
      relation: candidate.origin.relation as ParsedInput["origin"]["relation"],
      releaseManifestHash: candidate.origin.releaseManifestHash,
    },
    completedMigrationFingerprints:
      candidate.completedMigrationFingerprints as readonly string[],
  };
};

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
};
const canonicalJson = (value: unknown): string =>
  JSON.stringify(canonicalize(value));
const fingerprint = (value: unknown): string =>
  `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;

const failed = (
  code: ReleaseMigrationPlanCode,
  message: string,
  repair: string,
): ReleaseMigrationPlanResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "plan-only",
  executionAvailable: false,
  resolutions: [{ code, message, repair }],
});

export const planReviewedReleaseMigration = (
  candidate: unknown,
): ReleaseMigrationPlanResult => {
  const input = parseInput(candidate);
  if (!input)
    return failed(
      "RELEASE_MIGRATION_INPUT_INVALID",
      "Release migration input does not match the closed V1 contract.",
      "Rebuild it from the reviewed release migration manifest.",
    );

  if (canonicalJson(input.manifest) !== canonicalJson(REVIEWED_MANIFEST))
    return failed(
      "RELEASE_MIGRATION_REVIEW_MISMATCH",
      "Migration manifest content or reviewed hashes do not match this module.",
      "Use the exact reviewed manifest committed beside this planner.",
    );

  if (
    input.origin.relation !== "immediate-prior" ||
    input.origin.version !== REVIEWED_MANIFEST.transition.fromVersion
  )
    return failed(
      "RELEASE_MIGRATION_ORIGIN_UNSUPPORTED",
      "Only the exact immediately prior release is supported.",
      "Use a separately reviewed transition; do not compose migration deltas.",
    );

  if (
    input.origin.releaseManifestHash !==
    REVIEWED_MANIFEST.releaseManifests.from.sha256
  )
    return failed(
      "RELEASE_MIGRATION_ORIGIN_HASH_MISMATCH",
      "Origin release manifest hash does not match the reviewed prior release.",
      "Restore the exact reviewed prior release before planning migration.",
    );

  const migrationFingerprint = fingerprint(REVIEWED_MANIFEST);
  if (
    input.completedMigrationFingerprints.some(
      (completed) => completed !== migrationFingerprint,
    )
  )
    return failed(
      "RELEASE_MIGRATION_COMPLETION_UNREVIEWED",
      "Completion evidence names an unreviewed migration fingerprint.",
      "Discard stale evidence and verify only the exact reviewed transition.",
    );

  return {
    ok: true,
    schemaVersion: 1,
    mode: "plan-only",
    executionAvailable: false,
    status:
      input.completedMigrationFingerprints.length === 1
        ? "already-applied"
        : "planned",
    transitionId: REVIEWED_MANIFEST.transition.id,
    fromVersion: REVIEWED_MANIFEST.transition.fromVersion,
    toVersion: REVIEWED_MANIFEST.transition.toVersion,
    migrationId: REVIEWED_MANIFEST.handoff.migrationId,
    migrationFingerprint,
    reviewedHashes: {
      fromReleaseManifest: REVIEWED_MANIFEST.releaseManifests.from.sha256,
      toReleaseManifest: REVIEWED_MANIFEST.releaseManifests.to.sha256,
      handoffFixture: REVIEWED_MANIFEST.handoff.fixture.sha256,
      handoffPlanner: REVIEWED_MANIFEST.handoff.planner.sha256,
    },
    steps: REVIEWED_MANIFEST.steps,
    rollback: REVIEWED_MANIFEST.rollback,
  };
};
