import { createHash } from "node:crypto";
import { analyzeUpgradeSafety } from "./collisions.js";
import {
  UPGRADE_OPERATION_KINDS,
  type UpgradeManifestV1,
  type UpgradeOperationV1,
  type UpgradePlanInputV1,
  type UpgradePlanResult,
  type UpgradeRequirementKind,
  type UpgradeResolution,
  type UpgradeTargetV1,
} from "./contract.js";

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value === value.trim() &&
  value === value.normalize("NFC");
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
const containsControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    );
  });
const safePath = (value: unknown): value is string =>
  text(value) &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  !containsControlCharacter(value) &&
  value
    .split("/")
    .every((part) => part.length > 0 && part !== "." && part !== "..");
const onlyKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => Object.keys(value).every((key) => keys.includes(key));

const invalid = (message: string): UpgradePlanResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "plan-only",
  writeAvailable: false,
  resolutions: [
    {
      code: "UPGRADE_INPUT_INVALID",
      message,
      repair:
        "Regenerate the plan input from the reviewed V1 release manifest and target snapshot.",
    },
  ],
});

const readOperation = (value: unknown): UpgradeOperationV1 | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "id",
      "kind",
      "path",
      "fromPath",
      "ownership",
      "beforeHash",
      "afterHash",
    ]) ||
    !text(value.id) ||
    !UPGRADE_OPERATION_KINDS.includes(
      value.kind as (typeof UPGRADE_OPERATION_KINDS)[number],
    ) ||
    !safePath(value.path) ||
    (value.ownership !== "template-owned" && value.ownership !== "generated")
  ) {
    return undefined;
  }
  const kind = value.kind as UpgradeOperationV1["kind"];
  const fromPath = value.fromPath;
  const beforeHash = value.beforeHash;
  const afterHash = value.afterHash;
  if (
    (kind === "move" ? !safePath(fromPath) : fromPath !== undefined) ||
    (kind === "add"
      ? beforeHash !== undefined || !digest(afterHash)
      : kind === "delete"
        ? !digest(beforeHash) || afterHash !== undefined
        : !digest(beforeHash) || !digest(afterHash)) ||
    (kind === "regenerate" && value.ownership !== "generated") ||
    (kind !== "regenerate" && value.ownership !== "template-owned") ||
    (kind === "move" && fromPath === value.path)
  ) {
    return undefined;
  }
  return {
    id: value.id,
    kind,
    path: value.path,
    ...(typeof fromPath === "string" ? { fromPath } : {}),
    ownership: value.ownership,
    ...(typeof beforeHash === "string" ? { beforeHash } : {}),
    ...(typeof afterHash === "string" ? { afterHash } : {}),
  };
};

const requirementKinds: readonly UpgradeRequirementKind[] = [
  "manual-review",
  "data-migration",
  "provider-change",
  "environment-change",
];

const parseInput = (value: unknown): UpgradePlanInputV1 | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, ["schemaVersion", "manifest", "target"]) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.manifest) ||
    !onlyKeys(value.manifest, [
      "schemaVersion",
      "transition",
      "operations",
      "requirements",
    ]) ||
    value.manifest.schemaVersion !== 1 ||
    !isRecord(value.manifest.transition) ||
    !onlyKeys(value.manifest.transition, [
      "id",
      "fromVersion",
      "toVersion",
      "immediatePriorVersion",
    ]) ||
    !text(value.manifest.transition.id) ||
    !text(value.manifest.transition.fromVersion) ||
    !text(value.manifest.transition.toVersion) ||
    value.manifest.transition.immediatePriorVersion !==
      value.manifest.transition.fromVersion ||
    value.manifest.transition.fromVersion ===
      value.manifest.transition.toVersion ||
    !Array.isArray(value.manifest.operations) ||
    !Array.isArray(value.manifest.requirements) ||
    !isRecord(value.target) ||
    !onlyKeys(value.target, [
      "version",
      "relation",
      "commit",
      "clean",
      "files",
    ]) ||
    !text(value.target.version) ||
    !["immediate-prior", "older", "skipped", "newer"].includes(
      String(value.target.relation),
    ) ||
    !text(value.target.commit) ||
    typeof value.target.clean !== "boolean" ||
    !Array.isArray(value.target.files)
  ) {
    return undefined;
  }
  const operations = value.manifest.operations.map(readOperation);
  if (
    operations.some((operation) => operation === undefined) ||
    new Set(operations.map((operation) => operation?.id)).size !==
      operations.length
  ) {
    return undefined;
  }
  const requirements = value.manifest.requirements.map((requirement) => {
    if (
      !isRecord(requirement) ||
      !onlyKeys(requirement, ["id", "kind", "detail"]) ||
      !text(requirement.id) ||
      !requirementKinds.includes(requirement.kind as UpgradeRequirementKind) ||
      !text(requirement.detail)
    ) {
      return undefined;
    }
    return {
      id: requirement.id,
      kind: requirement.kind as UpgradeRequirementKind,
      detail: requirement.detail,
    };
  });
  const files = value.target.files.map((file) => {
    if (
      !isRecord(file) ||
      !onlyKeys(file, ["path", "ownership", "hash"]) ||
      !safePath(file.path) ||
      !["template-owned", "generated", "customer-owned"].includes(
        String(file.ownership),
      ) ||
      !digest(file.hash)
    ) {
      return undefined;
    }
    return {
      path: file.path,
      ownership:
        file.ownership as UpgradeTargetV1["files"][number]["ownership"],
      hash: file.hash,
    };
  });
  if (
    requirements.some((requirement) => requirement === undefined) ||
    files.some((file) => file === undefined) ||
    new Set(files.map((file) => file?.path)).size !== files.length
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    manifest: {
      schemaVersion: 1,
      transition: {
        id: value.manifest.transition.id,
        fromVersion: value.manifest.transition.fromVersion,
        toVersion: value.manifest.transition.toVersion,
        immediatePriorVersion: value.manifest.transition.immediatePriorVersion,
      },
      operations: operations as UpgradeOperationV1[],
      requirements: requirements as UpgradeManifestV1["requirements"],
    },
    target: {
      version: value.target.version,
      relation: value.target.relation as UpgradeTargetV1["relation"],
      commit: value.target.commit,
      clean: value.target.clean,
      files: files as UpgradeTargetV1["files"],
    },
  };
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
};
const fingerprint = (value: unknown): string =>
  `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
const normalizeManifest = (manifest: UpgradeManifestV1): UpgradeManifestV1 => ({
  ...manifest,
  operations: [...manifest.operations].sort((left, right) =>
    compareText(left.id, right.id),
  ),
  requirements: [...manifest.requirements].sort((left, right) =>
    compareText(left.id, right.id),
  ),
});

const relationshipResolution = (
  input: UpgradePlanInputV1,
): UpgradeResolution | undefined => {
  const { relation, version } = input.target;
  if (relation === "older") {
    return {
      code: "UPGRADE_SOURCE_OLDER",
      message: `Target version "${version}" is older than the single supported transition.`,
      repair: `Use a reviewed migration to ${input.manifest.transition.fromVersion}; do not compose unproved deltas.`,
    };
  }
  if (relation === "skipped") {
    return {
      code: "UPGRADE_SOURCE_SKIPPED",
      message: `Target version "${version}" skips the immediately prior supported release.`,
      repair: `Move to ${input.manifest.transition.fromVersion} through a separately reviewed transition.`,
    };
  }
  if (relation === "newer") {
    return {
      code: "UPGRADE_SOURCE_NEWER",
      message: `Target version "${version}" is newer than this upgrade tool.`,
      repair:
        "Use a tool whose reviewed manifest names the target as its immediate prior release.",
    };
  }
  if (version !== input.manifest.transition.fromVersion) {
    return {
      code: "UPGRADE_SOURCE_MISMATCH",
      message: `Target version "${version}" does not equal reviewed prior version "${input.manifest.transition.fromVersion}".`,
      repair:
        "Regenerate the resolution from canonical template-instance compatibility authority.",
    };
  }
  return undefined;
};

const requirementResolution = (
  requirement: UpgradeManifestV1["requirements"][number],
): UpgradeResolution => {
  const mapping: Record<
    UpgradeRequirementKind,
    { readonly code: UpgradeResolution["code"]; readonly repair: string }
  > = {
    "manual-review": {
      code: "UPGRADE_MANUAL_REVIEW",
      repair: "Resolve and approve the manual item outside apply-safe.",
    },
    "data-migration": {
      code: "UPGRADE_DATA_MIGRATION",
      repair:
        "Run the separately authorized migration preview and attach its required receipt.",
    },
    "provider-change": {
      code: "UPGRADE_PROVIDER_CHANGE",
      repair:
        "Use the explicit provider promotion workflow; file upgrade cannot change providers.",
    },
    "environment-change": {
      code: "UPGRADE_ENVIRONMENT_CHANGE",
      repair:
        "Apply environment changes through their named operator-owned plan.",
    },
  };
  return {
    code: mapping[requirement.kind].code,
    operationId: requirement.id,
    message: requirement.detail,
    repair: mapping[requirement.kind].repair,
  };
};

export const planUpgrade = (candidate: unknown): UpgradePlanResult => {
  const input = parseInput(candidate);
  if (!input)
    return invalid("Upgrade plan input does not match the closed V1 contract.");
  const normalizedManifest = normalizeManifest(input.manifest);
  const relation = relationshipResolution(input);
  const analysis = analyzeUpgradeSafety(normalizedManifest, input.target);
  const targetClean: UpgradeResolution[] = input.target.clean
    ? []
    : [
        {
          code: "UPGRADE_TARGET_DIRTY" as const,
          message: "Upgrade planning requires a clean committed target.",
          repair:
            "Commit or discard target changes, then rebuild the plan from Git.",
        },
      ];
  const resolutions = [
    ...(relation ? [relation] : []),
    ...targetClean,
    ...normalizedManifest.requirements.map(requirementResolution),
    ...analysis.resolutions,
  ].sort((left, right) => {
    const code = compareText(left.code, right.code);
    return code === 0
      ? compareText(left.operationId ?? "", right.operationId ?? "")
      : code;
  });
  if (resolutions.length > 0) {
    return {
      ok: false,
      schemaVersion: 1,
      mode: "plan-only",
      writeAvailable: false,
      resolutions,
    };
  }
  const manifestFingerprint = fingerprint(normalizedManifest);
  const normalizedFiles = [...input.target.files].sort((left, right) =>
    compareText(left.path, right.path),
  );
  return {
    ok: true,
    schemaVersion: 1,
    mode: "plan-only",
    writeAvailable: false,
    transitionId: normalizedManifest.transition.id,
    manifestFingerprint,
    planFingerprint: fingerprint({
      manifestFingerprint,
      target: { ...input.target, files: normalizedFiles },
      diff: analysis.diff,
    }),
    targetCommit: input.target.commit,
    targetClean: input.target.clean,
    diff: analysis.diff,
  };
};
