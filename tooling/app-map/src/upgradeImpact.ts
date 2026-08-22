import { buildAppMapImpact, type AppMapImpactV1 } from "./impact";

export type ReviewedUpgradeImpactV1 = {
  readonly schemaVersion: 1;
  readonly authority: "reviewed-upgrade-plan";
  readonly transitionId: string;
  readonly manifestFingerprint: `sha256:${string}`;
  readonly planFingerprint: `sha256:${string}`;
  readonly targetCommit: string;
  readonly impact: AppMapImpactV1;
};

export type ReviewedUpgradeImpactResult =
  | { readonly ok: true; readonly value: ReviewedUpgradeImpactV1 }
  | {
      readonly ok: false;
      readonly diagnostic: {
        readonly code:
          | "APP_MAP_UPGRADE_IMPACT_INVALID_REVIEW"
          | "APP_MAP_UPGRADE_IMPACT_INCOMPLETE";
        readonly message: string;
        readonly repair: string;
      };
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const onlyKeys = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));
const revision = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{7,64}$/u.test(value);
const fingerprint = (value: unknown): value is `sha256:${string}` =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
const nonempty = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value === value.trim() &&
  value === value.normalize("NFC");
const safePath = (value: unknown): value is string =>
  nonempty(value) &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  value
    .split("/")
    .every((part) => part.length > 0 && part !== "." && part !== "..");
const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const failure = (
  code:
    | "APP_MAP_UPGRADE_IMPACT_INVALID_REVIEW"
    | "APP_MAP_UPGRADE_IMPACT_INCOMPLETE",
  message: string,
): ReviewedUpgradeImpactResult => ({
  ok: false,
  diagnostic: {
    code,
    message,
    repair:
      "Regenerate impact from the canonical App Map and attach the exact reviewed upgrade plan paths and fingerprints.",
  },
});

export const projectReviewedUpgradeImpact = (
  candidate: unknown,
): ReviewedUpgradeImpactResult => {
  if (
    !isRecord(candidate) ||
    !onlyKeys(candidate, [
      "schemaVersion",
      "authority",
      "transitionId",
      "manifestFingerprint",
      "planFingerprint",
      "targetCommit",
      "reviewedPaths",
      "impactInput",
    ]) ||
    candidate.schemaVersion !== 1 ||
    candidate.authority !== "reviewed-upgrade-plan" ||
    !nonempty(candidate.transitionId) ||
    !fingerprint(candidate.manifestFingerprint) ||
    !fingerprint(candidate.planFingerprint) ||
    !revision(candidate.targetCommit) ||
    !Array.isArray(candidate.reviewedPaths) ||
    !candidate.reviewedPaths.every(safePath)
  ) {
    return failure(
      "APP_MAP_UPGRADE_IMPACT_INVALID_REVIEW",
      "Upgrade impact review does not match the closed V1 contract.",
    );
  }

  const projected = buildAppMapImpact(candidate.impactInput);
  if (!projected.ok) {
    return failure(
      "APP_MAP_UPGRADE_IMPACT_INVALID_REVIEW",
      "Canonical App Map impact could not be rebuilt from the reviewed input.",
    );
  }
  const reviewedPaths = [...new Set(candidate.reviewedPaths)].sort(compareText);
  if (
    !projected.impact.complete ||
    projected.impact.risk === "unknown" ||
    projected.impact.baseRevision !== candidate.targetCommit ||
    JSON.stringify(reviewedPaths) !==
      JSON.stringify(projected.impact.changedPaths)
  ) {
    return failure(
      "APP_MAP_UPGRADE_IMPACT_INCOMPLETE",
      "Reviewed upgrade paths, target commit, and complete App Map impact do not agree.",
    );
  }

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      authority: "reviewed-upgrade-plan",
      transitionId: candidate.transitionId,
      manifestFingerprint: candidate.manifestFingerprint,
      planFingerprint: candidate.planFingerprint,
      targetCommit: candidate.targetCommit,
      impact: projected.impact,
    },
  };
};
