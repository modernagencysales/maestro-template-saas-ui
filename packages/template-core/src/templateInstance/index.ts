export const TEMPLATE_INSTANCE_SCHEMA_VERSION = 2 as const;
export const TEMPLATE_INSTANCE_COMPATIBILITY_SET_VERSION = 1 as const;

export const CURRENT_TEMPLATE_INSTANCE_VERSIONS = Object.freeze({
  pack: "0.1.0-alpha.1",
  cli: "0.1.0-alpha.1",
  template: "0.2.0-alpha.1",
  workflowSchema: 2,
  compatibilitySet: TEMPLATE_INSTANCE_COMPATIBILITY_SET_VERSION,
} as const);

export type TemplateInstanceSupportState = "supported" | "planned";
export type TemplateInstanceReleaseAvailability = "unavailable";
export type TemplateInstanceReleaseEvidence = "workspace-only" | "fixture-only";

export type TemplateHostCompatibility = {
  readonly templateVersion: string;
  readonly templateTag: string;
  readonly packRange: string;
  readonly cliRange: string;
  readonly supportState: TemplateInstanceSupportState;
  readonly deprecationDate: string | null;
  readonly releaseAvailability: TemplateInstanceReleaseAvailability;
  readonly releaseEvidence: TemplateInstanceReleaseEvidence;
};

const currentHostCompatibility = Object.freeze({
  templateVersion: "0.2.0-alpha.1",
  templateTag: "maestro-template-v0.2.0-alpha.1",
  packRange: ">=0.1.0-alpha.1 <0.2.0",
  cliRange: ">=0.1.0-alpha.1 <0.2.0",
  supportState: "supported",
  deprecationDate: null,
  releaseAvailability: "unavailable",
  releaseEvidence: "workspace-only",
} as const satisfies TemplateHostCompatibility);

const previousHostCompatibility = Object.freeze({
  templateVersion: "0.1.0-alpha.1",
  templateTag: "maestro-template-v0.1.0-alpha.1",
  packRange: ">=0.1.0-alpha.1 <0.2.0",
  cliRange: ">=0.1.0-alpha.1 <0.2.0",
  supportState: "planned",
  deprecationDate: null,
  releaseAvailability: "unavailable",
  releaseEvidence: "fixture-only",
} as const satisfies TemplateHostCompatibility);

export const TEMPLATE_INSTANCE_COMPATIBILITY = Object.freeze({
  current: currentHostCompatibility,
  previous: previousHostCompatibility,
} as const);

export const TEMPLATE_INSTANCE_PROVENANCE = Object.freeze({
  owner: "@maestro-template/template-core/templateInstance",
  schemaVersion: TEMPLATE_INSTANCE_SCHEMA_VERSION,
  compatibilitySet: TEMPLATE_INSTANCE_COMPATIBILITY_SET_VERSION,
} as const);

export const TEMPLATE_INSTANCE_EXTENSION_CONTRACT = Object.freeze({
  topLevel: Object.freeze([
    "blueprint",
    "customerExtension",
    "personalization",
    "ownership",
  ] as const),
  namespacePrefix: "x-",
  legacyV0Projection: Object.freeze([
    "name",
    "slug",
    "packageScope",
    "workspaceName",
    "blueprint",
    "providerMode",
    "environments",
    "deploymentTargets",
    "modules",
    "requiredSecretNames",
    "redactionStatus",
    "sourcePosture",
    "providers",
    "releaseState",
    "upgradeCompatibility",
    "privatePackages",
    "intake",
    "generatedAt",
  ] as const),
} as const);

export type TemplateInstanceVersions = {
  readonly pack: string;
  readonly cli: string;
  readonly template: string;
  readonly workflowSchema: number;
  readonly compatibilitySet: number;
};

export type TemplateInstanceRelease = {
  readonly version: string;
  readonly tag: string;
  readonly sourceCommit?: string;
  readonly sourceChecksum?: string;
};

export type TemplateInstanceSupport = {
  readonly state: TemplateInstanceSupportState;
  readonly deprecationDate: string | null;
  readonly releaseAvailability: TemplateInstanceReleaseAvailability;
  readonly releaseEvidence: TemplateInstanceReleaseEvidence;
};

export type TemplateInstance = Readonly<Record<string, unknown>> & {
  readonly schemaVersion: typeof TEMPLATE_INSTANCE_SCHEMA_VERSION;
  readonly versions: TemplateInstanceVersions;
  readonly release: TemplateInstanceRelease;
  readonly compatibility: typeof TEMPLATE_INSTANCE_COMPATIBILITY;
  readonly support: TemplateInstanceSupport;
  readonly provenance: typeof TEMPLATE_INSTANCE_PROVENANCE;
};

export type TemplateInstanceCompatibilityStatus =
  "compatible" | "migratable" | "unsupported" | "newer";

export type TemplateInstanceCompatibilityCode =
  | "TEMPLATE_INSTANCE_COMPATIBLE"
  | "TEMPLATE_INSTANCE_MIGRATION_AVAILABLE"
  | "TEMPLATE_INSTANCE_MIGRATION_PLANNED_UNAVAILABLE"
  | "TEMPLATE_INSTANCE_MALFORMED"
  | "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS"
  | "TEMPLATE_INSTANCE_UNSUPPORTED_RELEASE_GAP"
  | "TEMPLATE_INSTANCE_NEWER_THAN_TOOL";

export type TemplateInstanceCompatibilityAxis =
  | "none"
  | "identity"
  | "schemaVersion"
  | "templateTag"
  | "compatibilitySet"
  | "pack"
  | "cli"
  | "template"
  | "workflowSchema"
  | "agentPackRange"
  | "cliRange"
  | "support"
  | "provenance";

export type TemplateInstanceCompatibilityReason =
  | "exact-match"
  | "migration-available"
  | "planned-unavailable"
  | "missing"
  | "malformed"
  | "mismatch"
  | "newer";

export type TemplateInstanceCompatibilityInput = unknown;

export type TemplateInstanceResolutionPacket = {
  readonly status: TemplateInstanceCompatibilityStatus;
  readonly code: TemplateInstanceCompatibilityCode;
  readonly basis: {
    readonly axis: TemplateInstanceCompatibilityAxis;
    readonly reason: TemplateInstanceCompatibilityReason;
  };
  readonly target: {
    readonly schemaVersion: number | null;
    readonly packVersion: string | null;
    readonly cliVersion: string | null;
    readonly templateVersion: string | null;
    readonly templateTag: string | null;
    readonly workflowSchema: number | null;
    readonly compatibilitySet: number | null;
    readonly agentPackRange: string | null;
    readonly cliRange: string | null;
    readonly supportState: string | null;
    readonly releaseAvailability: string | null;
  };
  readonly safeToContinueReadOnly: true;
  readonly lastSupported: {
    readonly packVersion: string;
    readonly cliVersion: string;
    readonly templateVersion: string;
    readonly templateTag: string;
    readonly releaseAvailability: TemplateInstanceReleaseAvailability;
  };
  readonly recovery:
    | { readonly kind: "none"; readonly action: string }
    | { readonly kind: "migrate"; readonly action: string }
    | { readonly kind: "migration-planned"; readonly action: string }
    | { readonly kind: "inspect-only"; readonly action: string }
    | { readonly kind: "use-supported-tool"; readonly action: string };
  readonly provenance: typeof TEMPLATE_INSTANCE_PROVENANCE;
};

export class TemplateInstanceSchemaError extends Error {
  readonly code = "TEMPLATE_INSTANCE_SCHEMA_INVALID" as const;

  constructor(readonly findings: readonly string[]) {
    super(`Invalid template-instance.json: ${findings.join("; ")}`);
    this.name = "TemplateInstanceSchemaError";
  }
}

export interface TemplateInstanceSchemaProvider {
  readonly schemaVersion: typeof TEMPLATE_INSTANCE_SCHEMA_VERSION;
  readonly versions: typeof CURRENT_TEMPLATE_INSTANCE_VERSIONS;
  readonly provenance: typeof TEMPLATE_INSTANCE_PROVENANCE;
  readonly compatibility: typeof TEMPLATE_INSTANCE_COMPATIBILITY;
  readonly parse: (input: unknown) => TemplateInstance;
  readonly parseText: (raw: string) => TemplateInstance;
  readonly serialize: (instance: TemplateInstance) => string;
  readonly resolve: (
    input: TemplateInstanceCompatibilityInput,
  ) => TemplateInstanceResolutionPacket;
}

type RecordValue = Record<string, unknown>;
type HostKind = "current" | "previous";

type CompatibilityIssue = {
  readonly axis: TemplateInstanceCompatibilityAxis;
  readonly reason: "missing" | "malformed" | "mismatch" | "newer";
  readonly finding: string;
};

type RecognizedInput = {
  readonly host: HostKind;
  readonly generation: 0 | 1 | 2;
};

const v2CoreKeys = new Set([
  "schemaVersion",
  "versions",
  "release",
  "compatibility",
  "support",
  "provenance",
]);

const v1CoreKeys = new Set(["schemaVersion", "release", "compatibility"]);

const explicitExtensionKeys = new Set<string>([
  ...TEMPLATE_INSTANCE_EXTENSION_CONTRACT.topLevel,
  ...TEMPLATE_INSTANCE_EXTENSION_CONTRACT.legacyV0Projection,
]);

const legacyV0Keys = new Set<string>([
  "schemaVersion",
  ...TEMPLATE_INSTANCE_EXTENSION_CONTRACT.legacyV0Projection,
  "customerExtension",
]);

const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteInteger = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value);

const isNamespacedExtension = (key: string): boolean =>
  key.startsWith(TEMPLATE_INSTANCE_EXTENSION_CONTRACT.namespacePrefix) &&
  key.length > TEMPLATE_INSTANCE_EXTENSION_CONTRACT.namespacePrefix.length;

const isAllowedExtension = (key: string): boolean =>
  explicitExtensionKeys.has(key) || isNamespacedExtension(key);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const sortedUnknownKeys = (
  value: RecordValue,
  allowed: ReadonlySet<string>,
): readonly string[] =>
  Object.keys(value)
    .filter((key) => !allowed.has(key))
    .sort(compareCodeUnits);

const unknownTopLevelKeys = (
  value: RecordValue,
  core: ReadonlySet<string>,
): readonly string[] =>
  Object.keys(value)
    .filter((key) => !core.has(key) && !isAllowedExtension(key))
    .sort(compareCodeUnits);

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareCodeUnits)
      .map((key) => [key, canonicalize(value[key])]),
  );
};

const issue = (
  axis: TemplateInstanceCompatibilityAxis,
  reason: CompatibilityIssue["reason"],
  finding: string,
): CompatibilityIssue => ({ axis, reason, finding });

const stringArray = (value: unknown): boolean =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const hostForIdentity = (
  version: unknown,
  tag: unknown,
): HostKind | CompatibilityIssue => {
  if (
    version === currentHostCompatibility.templateVersion &&
    tag === currentHostCompatibility.templateTag
  ) {
    return "current";
  }
  if (
    version === previousHostCompatibility.templateVersion &&
    tag === previousHostCompatibility.templateTag
  ) {
    return "previous";
  }
  if (!isNonEmptyString(tag)) {
    return issue(
      "templateTag",
      "missing",
      "release.tag must be a non-empty string",
    );
  }
  if (
    tag !== currentHostCompatibility.templateTag &&
    tag !== previousHostCompatibility.templateTag
  ) {
    return issue(
      "templateTag",
      "mismatch",
      "release.tag is outside the exact current/previous identities",
    );
  }
  return issue(
    "template",
    isNonEmptyString(version) ? "mismatch" : "missing",
    "release.version must match its exact declared tag identity",
  );
};

const validateRelease = (
  value: unknown,
): {
  readonly host?: HostKind;
  readonly issues: readonly CompatibilityIssue[];
} => {
  if (!isRecord(value)) {
    return {
      issues: [issue("templateTag", "missing", "release must be an object")],
    };
  }
  const unknown = sortedUnknownKeys(
    value,
    new Set(["version", "tag", "sourceCommit", "sourceChecksum"]),
  );
  if (unknown[0] !== undefined) {
    return {
      issues: [
        issue(
          "templateTag",
          "malformed",
          `release has unknown field ${unknown[0]}`,
        ),
      ],
    };
  }
  for (const optional of ["sourceCommit", "sourceChecksum"] as const) {
    if (value[optional] !== undefined && !isNonEmptyString(value[optional])) {
      return {
        issues: [
          issue(
            "templateTag",
            "malformed",
            `release.${optional} must be a non-empty string when present`,
          ),
        ],
      };
    }
  }
  const identity = hostForIdentity(value.version, value.tag);
  return typeof identity === "string"
    ? { host: identity, issues: [] }
    : { issues: [identity] };
};

const hostCompatibility = (host: HostKind): TemplateHostCompatibility =>
  host === "current" ? currentHostCompatibility : previousHostCompatibility;

const validateHostRecord = (
  path: string,
  value: unknown,
  expected: TemplateHostCompatibility,
): readonly CompatibilityIssue[] => {
  if (!isRecord(value)) {
    return [issue("agentPackRange", "missing", `${path} must be an object`)];
  }
  const allowed = new Set([
    "templateVersion",
    "templateTag",
    "packRange",
    "cliRange",
    "supportState",
    "deprecationDate",
    "releaseAvailability",
    "releaseEvidence",
  ]);
  const unknown = sortedUnknownKeys(value, allowed);
  if (unknown[0] !== undefined) {
    return [
      issue(
        "agentPackRange",
        "malformed",
        `${path} has unknown field ${unknown[0]}`,
      ),
    ];
  }
  const comparisons = [
    ["templateTag", "templateTag"],
    ["templateVersion", "template"],
    ["packRange", "agentPackRange"],
    ["cliRange", "cliRange"],
    ["supportState", "support"],
    ["deprecationDate", "support"],
    ["releaseAvailability", "support"],
    ["releaseEvidence", "support"],
  ] as const;
  for (const [key, axis] of comparisons) {
    if (value[key] !== expected[key]) {
      return [
        issue(axis, "mismatch", `${path}.${key} must match canonical evidence`),
      ];
    }
  }
  return [];
};

const validateCompatibility = (
  value: unknown,
): readonly CompatibilityIssue[] => {
  if (!isRecord(value)) {
    return [
      issue("agentPackRange", "missing", "compatibility must be an object"),
    ];
  }
  const unknown = sortedUnknownKeys(value, new Set(["current", "previous"]));
  if (unknown[0] !== undefined) {
    return [
      issue(
        "agentPackRange",
        "malformed",
        `compatibility has unknown field ${unknown[0]}`,
      ),
    ];
  }
  const currentIssues = validateHostRecord(
    "compatibility.current",
    value.current,
    currentHostCompatibility,
  );
  if (currentIssues.length > 0) return currentIssues;
  return validateHostRecord(
    "compatibility.previous",
    value.previous,
    previousHostCompatibility,
  );
};

const validateSupport = (
  value: unknown,
  host: HostKind,
): readonly CompatibilityIssue[] => {
  if (!isRecord(value)) {
    return [issue("support", "missing", "support must be an object")];
  }
  const unknown = sortedUnknownKeys(
    value,
    new Set([
      "state",
      "deprecationDate",
      "releaseAvailability",
      "releaseEvidence",
    ]),
  );
  if (unknown[0] !== undefined) {
    return [
      issue("support", "malformed", `support has unknown field ${unknown[0]}`),
    ];
  }
  const expected = hostCompatibility(host);
  if (
    value.state !== expected.supportState ||
    value.deprecationDate !== expected.deprecationDate ||
    value.releaseAvailability !== expected.releaseAvailability ||
    value.releaseEvidence !== expected.releaseEvidence
  ) {
    return [
      issue("support", "mismatch", "support must match exact release evidence"),
    ];
  }
  return [];
};

const validateProvenance = (value: unknown): readonly CompatibilityIssue[] => {
  if (!isRecord(value)) {
    return [issue("provenance", "missing", "provenance must be an object")];
  }
  const unknown = sortedUnknownKeys(
    value,
    new Set(["owner", "schemaVersion", "compatibilitySet"]),
  );
  if (unknown[0] !== undefined) {
    return [
      issue(
        "provenance",
        "malformed",
        `provenance has unknown field ${unknown[0]}`,
      ),
    ];
  }
  if (
    value.owner !== TEMPLATE_INSTANCE_PROVENANCE.owner ||
    value.schemaVersion !== TEMPLATE_INSTANCE_PROVENANCE.schemaVersion ||
    value.compatibilitySet !== TEMPLATE_INSTANCE_PROVENANCE.compatibilitySet
  ) {
    return [
      issue(
        "provenance",
        "mismatch",
        "provenance must identify the canonical template schema",
      ),
    ];
  }
  return [];
};

const validateVersions = (
  value: unknown,
  host: HostKind,
): readonly CompatibilityIssue[] => {
  if (!isRecord(value)) {
    return [issue("pack", "missing", "versions must be an object")];
  }
  const unknown = sortedUnknownKeys(
    value,
    new Set(["pack", "cli", "template", "workflowSchema", "compatibilitySet"]),
  );
  if (unknown[0] !== undefined) {
    return [
      issue(
        "compatibilitySet",
        "malformed",
        `versions has unknown field ${unknown[0]}`,
      ),
    ];
  }

  for (const [key, axis] of [
    ["compatibilitySet", "compatibilitySet"],
    ["workflowSchema", "workflowSchema"],
  ] as const) {
    const version = value[key];
    if (!isFiniteInteger(version)) {
      return [
        issue(axis, "malformed", `versions.${key} must be a finite integer`),
      ];
    }
    const expected = CURRENT_TEMPLATE_INSTANCE_VERSIONS[key];
    if (version > expected) {
      return [issue(axis, "newer", `versions.${key} is newer than this tool`)];
    }
  }

  for (const [key, axis, expected] of [
    [
      "compatibilitySet",
      "compatibilitySet",
      CURRENT_TEMPLATE_INSTANCE_VERSIONS.compatibilitySet,
    ],
    ["pack", "pack", CURRENT_TEMPLATE_INSTANCE_VERSIONS.pack],
    ["cli", "cli", CURRENT_TEMPLATE_INSTANCE_VERSIONS.cli],
    ["template", "template", hostCompatibility(host).templateVersion],
    [
      "workflowSchema",
      "workflowSchema",
      CURRENT_TEMPLATE_INSTANCE_VERSIONS.workflowSchema,
    ],
  ] as const) {
    if (value[key] !== expected) {
      return [
        issue(axis, "mismatch", `versions.${key} must match exact evidence`),
      ];
    }
  }
  return [];
};

const validateV2 = (
  input: RecordValue,
): {
  readonly recognized?: RecognizedInput;
  readonly issues: readonly CompatibilityIssue[];
} => {
  const topUnknown = unknownTopLevelKeys(input, v2CoreKeys);
  if (topUnknown[0] !== undefined) {
    return {
      issues: [
        issue(
          "identity",
          "malformed",
          `unsupported top-level field ${topUnknown[0]}`,
        ),
      ],
    };
  }
  const release = validateRelease(input.release);
  if (release.issues.length > 0 || release.host === undefined) {
    return { issues: release.issues };
  }
  const versions = validateVersions(input.versions, release.host);
  if (versions.length > 0) return { issues: versions };
  const compatibility = validateCompatibility(input.compatibility);
  if (compatibility.length > 0) return { issues: compatibility };
  const support = validateSupport(input.support, release.host);
  if (support.length > 0) return { issues: support };
  const provenance = validateProvenance(input.provenance);
  if (provenance.length > 0) return { issues: provenance };
  return { recognized: { host: release.host, generation: 2 }, issues: [] };
};

const validateLegacyV1 = (
  input: RecordValue,
): {
  readonly recognized?: RecognizedInput;
  readonly issues: readonly CompatibilityIssue[];
} => {
  const topUnknown = unknownTopLevelKeys(input, v1CoreKeys);
  if (topUnknown[0] !== undefined) {
    return {
      issues: [
        issue(
          "identity",
          "malformed",
          `unsupported top-level field ${topUnknown[0]}`,
        ),
      ],
    };
  }
  const release = validateRelease(input.release);
  if (release.issues.length > 0 || release.host === undefined) {
    return { issues: release.issues };
  }
  if (!isRecord(input.compatibility)) {
    return {
      issues: [
        issue(
          "agentPackRange",
          "missing",
          "compatibility must declare exact cli and agentPack ranges",
        ),
      ],
    };
  }
  const unknown = sortedUnknownKeys(
    input.compatibility,
    new Set(["cli", "agentPack"]),
  );
  if (unknown[0] !== undefined) {
    return {
      issues: [
        issue(
          "agentPackRange",
          "malformed",
          `compatibility has unknown field ${unknown[0]}`,
        ),
      ],
    };
  }
  const expected = hostCompatibility(release.host);
  if (input.compatibility.agentPack !== expected.packRange) {
    return {
      issues: [
        issue(
          "agentPackRange",
          "mismatch",
          "compatibility.agentPack must match exact host evidence",
        ),
      ],
    };
  }
  if (input.compatibility.cli !== expected.cliRange) {
    return {
      issues: [
        issue(
          "cliRange",
          "mismatch",
          "compatibility.cli must match exact host evidence",
        ),
      ],
    };
  }
  return {
    recognized: { host: release.host, generation: 1 },
    issues: [],
  };
};

const validateLegacyNestedShape = (
  input: RecordValue,
): readonly CompatibilityIssue[] => {
  if (!isNonEmptyString(input.name) || !isNonEmptyString(input.slug)) {
    return [
      issue(
        "identity",
        "missing",
        "legacy V0 requires non-empty name and slug",
      ),
    ];
  }
  if (!new Set(["fake", "test", "live"]).has(String(input.providerMode))) {
    return [
      issue(
        "identity",
        "malformed",
        "legacy V0 providerMode must be fake, test, or live",
      ),
    ];
  }
  if (!isRecord(input.upgradeCompatibility)) {
    return [
      issue(
        "identity",
        "missing",
        "legacy V0 requires upgradeCompatibility identity",
      ),
    ];
  }
  const upgradeUnknown = sortedUnknownKeys(
    input.upgradeCompatibility,
    new Set([
      "templateVersion",
      "lastCheckedTemplateVersion",
      "status",
      "requiredChecks",
    ]),
  );
  if (upgradeUnknown[0] !== undefined) {
    return [
      issue(
        "identity",
        "malformed",
        `upgradeCompatibility has unknown field ${upgradeUnknown[0]}`,
      ),
    ];
  }
  const legacyVersion = input.upgradeCompatibility.templateVersion;
  if (
    legacyVersion !== "unreleased" &&
    legacyVersion !== currentHostCompatibility.templateVersion &&
    legacyVersion !== previousHostCompatibility.templateVersion
  ) {
    return [
      issue(
        "template",
        isNonEmptyString(legacyVersion) ? "mismatch" : "missing",
        "legacy V0 templateVersion is outside exact evidence",
      ),
    ];
  }
  if (
    input.upgradeCompatibility.status !== "not-checked" &&
    input.upgradeCompatibility.status !== "compatible" &&
    input.upgradeCompatibility.status !== "needs-review"
  ) {
    return [
      issue(
        "identity",
        "malformed",
        "legacy V0 upgradeCompatibility.status is invalid",
      ),
    ];
  }
  if (
    input.upgradeCompatibility.lastCheckedTemplateVersion !== undefined &&
    input.upgradeCompatibility.lastCheckedTemplateVersion !== null &&
    !isNonEmptyString(input.upgradeCompatibility.lastCheckedTemplateVersion)
  ) {
    return [
      issue(
        "identity",
        "malformed",
        "legacy V0 lastCheckedTemplateVersion is invalid",
      ),
    ];
  }
  if (
    input.upgradeCompatibility.requiredChecks !== undefined &&
    !stringArray(input.upgradeCompatibility.requiredChecks)
  ) {
    return [
      issue(
        "identity",
        "malformed",
        "legacy V0 requiredChecks must be an array of strings",
      ),
    ];
  }
  for (const key of ["packageScope", "workspaceName", "generatedAt"] as const) {
    if (input[key] !== undefined && !isNonEmptyString(input[key])) {
      return [
        issue(
          "identity",
          "malformed",
          `legacy V0 ${key} must be a non-empty string`,
        ),
      ];
    }
  }
  if (
    input.blueprint !== undefined &&
    !new Set([
      "source-grounded-gtm-brain",
      "gtm-implementation",
      "saas-application",
    ]).has(String(input.blueprint))
  ) {
    return [issue("identity", "malformed", "legacy V0 blueprint is invalid")];
  }
  if (
    input.redactionStatus !== undefined &&
    input.redactionStatus !== "reviewer-safe-fake-data" &&
    input.redactionStatus !== "requires-review"
  ) {
    return [
      issue("identity", "malformed", "legacy V0 redactionStatus is invalid"),
    ];
  }
  if (
    input.sourcePosture !== undefined &&
    input.sourcePosture !== "synthetic-demo-data" &&
    input.sourcePosture !== "client-data-review-required"
  ) {
    return [
      issue("identity", "malformed", "legacy V0 sourcePosture is invalid"),
    ];
  }
  for (const key of [
    "environments",
    "deploymentTargets",
    "modules",
    "requiredSecretNames",
  ]) {
    if (input[key] !== undefined && !stringArray(input[key])) {
      return [
        issue(
          "identity",
          "malformed",
          `legacy V0 ${key} must be an array of strings`,
        ),
      ];
    }
  }
  for (const [key, allowed] of [
    [
      "providers",
      new Set([
        "convex",
        "workos",
        "posthog",
        "dodo",
        "email",
        "llm",
        "storage",
      ]),
    ],
    ["releaseState", new Set(["stage", "promotedCommit", "lastHandoffAt"])],
    ["privatePackages", new Set(["enabled", "packages", "promotionPolicy"])],
    ["intake", new Set(["status", "briefPath", "generatedAt", "blueprint"])],
  ] as const) {
    if (input[key] === undefined) continue;
    if (!isRecord(input[key])) {
      return [
        issue("identity", "malformed", `legacy V0 ${key} must be an object`),
      ];
    }
    const nestedUnknown = sortedUnknownKeys(input[key], allowed);
    if (nestedUnknown[0] !== undefined) {
      return [
        issue(
          "identity",
          "malformed",
          `legacy V0 ${key} has unknown field ${nestedUnknown[0]}`,
        ),
      ];
    }
  }
  if (isRecord(input.providers)) {
    const providerPostures = {
      convex: new Set(["fake", "configured"]),
      workos: new Set(["fake", "configured"]),
      posthog: new Set(["fake", "configured"]),
      dodo: new Set(["fake", "configured"]),
      email: new Set(["console", "configured"]),
      llm: new Set(["fake", "configured"]),
      storage: new Set(["local", "configured"]),
    } as const;
    for (const [key, values] of Object.entries(providerPostures)) {
      if (!values.has(String(input.providers[key]))) {
        return [
          issue(
            "identity",
            "malformed",
            `legacy V0 providers.${key} is invalid`,
          ),
        ];
      }
    }
  }
  if (isRecord(input.releaseState)) {
    if (
      !new Set(["local", "preview", "production"]).has(
        String(input.releaseState.stage),
      ) ||
      (input.releaseState.promotedCommit !== null &&
        !isNonEmptyString(input.releaseState.promotedCommit)) ||
      (input.releaseState.lastHandoffAt !== null &&
        !isNonEmptyString(input.releaseState.lastHandoffAt))
    ) {
      return [
        issue("identity", "malformed", "legacy V0 releaseState is invalid"),
      ];
    }
  }
  if (isRecord(input.privatePackages)) {
    if (
      typeof input.privatePackages.enabled !== "boolean" ||
      !stringArray(input.privatePackages.packages) ||
      input.privatePackages.promotionPolicy !== "contract-review-required"
    ) {
      return [
        issue("identity", "malformed", "legacy V0 privatePackages is invalid"),
      ];
    }
  }
  if (isRecord(input.intake)) {
    if (
      (input.intake.status !== "draft" && input.intake.status !== "reviewed") ||
      !isNonEmptyString(input.intake.briefPath) ||
      !isNonEmptyString(input.intake.generatedAt) ||
      !isNonEmptyString(input.intake.blueprint)
    ) {
      return [issue("identity", "malformed", "legacy V0 intake is invalid")];
    }
  }
  return [];
};

const validateLegacyV0 = (
  input: RecordValue,
): {
  readonly recognized?: RecognizedInput;
  readonly issues: readonly CompatibilityIssue[];
} => {
  const topUnknown = Object.keys(input)
    .filter((key) => !legacyV0Keys.has(key) && !isNamespacedExtension(key))
    .sort(compareCodeUnits);
  if (topUnknown[0] !== undefined) {
    return {
      issues: [
        issue(
          "identity",
          "malformed",
          `unsupported top-level field ${topUnknown[0]}`,
        ),
      ],
    };
  }
  const nested = validateLegacyNestedShape(input);
  if (nested.length > 0) return { issues: nested };
  const legacy = input.upgradeCompatibility as RecordValue;
  return {
    recognized: {
      host:
        legacy.templateVersion === previousHostCompatibility.templateVersion
          ? "previous"
          : "current",
      generation: 0,
    },
    issues: [],
  };
};

const numericFact = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const stringFact = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const targetFacts = (
  input: unknown,
): TemplateInstanceResolutionPacket["target"] => {
  const root = isRecord(input) ? input : {};
  const versions = isRecord(root.versions) ? root.versions : {};
  const release = isRecord(root.release) ? root.release : {};
  const compatibility = isRecord(root.compatibility) ? root.compatibility : {};
  const current = isRecord(compatibility.current) ? compatibility.current : {};
  const support = isRecord(root.support) ? root.support : {};
  const legacy = isRecord(root.upgradeCompatibility)
    ? root.upgradeCompatibility
    : {};
  const legacyTemplate =
    legacy.templateVersion === "unreleased"
      ? currentHostCompatibility.templateVersion
      : legacy.templateVersion;
  return {
    schemaVersion:
      root.schemaVersion === undefined ? null : numericFact(root.schemaVersion),
    packVersion: stringFact(versions.pack),
    cliVersion: stringFact(versions.cli),
    templateVersion:
      stringFact(versions.template) ??
      stringFact(release.version) ??
      stringFact(legacyTemplate),
    templateTag: stringFact(release.tag),
    workflowSchema: numericFact(versions.workflowSchema),
    compatibilitySet: numericFact(versions.compatibilitySet),
    agentPackRange:
      stringFact(compatibility.agentPack) ?? stringFact(current.packRange),
    cliRange: stringFact(compatibility.cli) ?? stringFact(current.cliRange),
    supportState: stringFact(support.state),
    releaseAvailability: stringFact(support.releaseAvailability),
  };
};

const packet = (
  input: unknown,
  result: Pick<
    TemplateInstanceResolutionPacket,
    "status" | "code" | "basis" | "recovery"
  >,
): TemplateInstanceResolutionPacket => ({
  ...result,
  target: targetFacts(input),
  safeToContinueReadOnly: true,
  lastSupported: {
    packVersion: CURRENT_TEMPLATE_INSTANCE_VERSIONS.pack,
    cliVersion: CURRENT_TEMPLATE_INSTANCE_VERSIONS.cli,
    templateVersion: currentHostCompatibility.templateVersion,
    templateTag: currentHostCompatibility.templateTag,
    releaseAvailability: currentHostCompatibility.releaseAvailability,
  },
  provenance: TEMPLATE_INSTANCE_PROVENANCE,
});

const unsupportedPacket = (
  input: unknown,
  incompatibility: CompatibilityIssue,
): TemplateInstanceResolutionPacket => {
  if (incompatibility.reason === "newer") {
    return packet(input, {
      status: "newer",
      code: "TEMPLATE_INSTANCE_NEWER_THAN_TOOL",
      basis: {
        axis: incompatibility.axis,
        reason: "newer",
      },
      recovery: {
        kind: "use-supported-tool",
        action:
          "Use a tool that explicitly supports the target's declared axes, or inspect read-only with this tool.",
      },
    });
  }
  const malformed =
    incompatibility.reason === "missing" ||
    incompatibility.reason === "malformed";
  return packet(input, {
    status: "unsupported",
    code:
      incompatibility.axis === "templateTag" &&
      incompatibility.reason === "mismatch"
        ? "TEMPLATE_INSTANCE_UNSUPPORTED_RELEASE_GAP"
        : malformed
          ? "TEMPLATE_INSTANCE_MALFORMED"
          : "TEMPLATE_INSTANCE_UNSUPPORTED_AXIS",
    basis: {
      axis: incompatibility.axis,
      reason: incompatibility.reason,
    },
    recovery: {
      kind: "inspect-only",
      action:
        "Preserve the target unchanged and inspect read-only; no published recovery tag is available.",
    },
  });
};

const migrationPacket = (
  input: unknown,
  recognized: RecognizedInput,
): TemplateInstanceResolutionPacket => {
  if (recognized.host === "previous") {
    return packet(input, {
      status: "migratable",
      code: "TEMPLATE_INSTANCE_MIGRATION_PLANNED_UNAVAILABLE",
      basis: { axis: "templateTag", reason: "planned-unavailable" },
      recovery: {
        kind: "migration-planned",
        action:
          "Preserve the target unchanged and inspect read-only; the previous-release path is planned but unavailable until a real Git tag is published and bound.",
      },
    });
  }
  return packet(input, {
    status: "migratable",
    code: "TEMPLATE_INSTANCE_MIGRATION_AVAILABLE",
    basis: { axis: "schemaVersion", reason: "migration-available" },
    recovery: {
      kind: "migrate",
      action:
        "Preview the pure template-instance schema migration; upgrade apply remains separately deferred.",
    },
  });
};

const recognize = (
  input: unknown,
): {
  readonly recognized?: RecognizedInput;
  readonly issues: readonly CompatibilityIssue[];
} => {
  if (!isRecord(input)) {
    return {
      issues: [
        issue("identity", "malformed", "template instance must be an object"),
      ],
    };
  }
  const rawSchema = input.schemaVersion;
  if (rawSchema === undefined) return validateLegacyV0(input);
  if (!isFiniteInteger(rawSchema)) {
    return {
      issues: [
        issue(
          "schemaVersion",
          "malformed",
          "schemaVersion must be a finite integer",
        ),
      ],
    };
  }
  if (rawSchema > TEMPLATE_INSTANCE_SCHEMA_VERSION) {
    return {
      issues: [
        issue(
          "schemaVersion",
          "newer",
          "schemaVersion is newer than this tool",
        ),
      ],
    };
  }
  if (rawSchema < 0) {
    return {
      issues: [
        issue("schemaVersion", "mismatch", "schemaVersion is not supported"),
      ],
    };
  }
  if (rawSchema === 0) return validateLegacyV0(input);
  if (rawSchema === 1) return validateLegacyV1(input);
  if (rawSchema === TEMPLATE_INSTANCE_SCHEMA_VERSION) return validateV2(input);
  return {
    issues: [
      issue("schemaVersion", "mismatch", "schemaVersion is not supported"),
    ],
  };
};

export const resolveTemplateInstanceCompatibility = (
  input: TemplateInstanceCompatibilityInput,
): TemplateInstanceResolutionPacket => {
  const recognition = recognize(input);
  const firstIssue = recognition.issues[0];
  if (firstIssue !== undefined) return unsupportedPacket(input, firstIssue);
  const recognized = recognition.recognized;
  if (recognized === undefined) {
    return unsupportedPacket(
      input,
      issue("identity", "malformed", "template instance identity is missing"),
    );
  }
  if (recognized.generation < TEMPLATE_INSTANCE_SCHEMA_VERSION) {
    return migrationPacket(input, recognized);
  }
  if (recognized.host === "previous") return migrationPacket(input, recognized);
  return packet(input, {
    status: "compatible",
    code: "TEMPLATE_INSTANCE_COMPATIBLE",
    basis: { axis: "none", reason: "exact-match" },
    recovery: {
      kind: "none",
      action: "Continue with the current tool and exact template instance.",
    },
  });
};

const canonicalExtensions = (input: RecordValue): RecordValue =>
  Object.fromEntries(
    Object.keys(input)
      .filter((key) => !v2CoreKeys.has(key) && isAllowedExtension(key))
      .sort(compareCodeUnits)
      .map((key) => [key, canonicalize(input[key])]),
  );

export const parseTemplateInstance = (input: unknown): TemplateInstance => {
  if (!isRecord(input)) {
    throw new TemplateInstanceSchemaError([
      "template instance must be an object",
    ]);
  }
  if (input.schemaVersion !== TEMPLATE_INSTANCE_SCHEMA_VERSION) {
    throw new TemplateInstanceSchemaError([
      `schemaVersion must be ${String(TEMPLATE_INSTANCE_SCHEMA_VERSION)}`,
    ]);
  }
  const validated = validateV2(input);
  if (validated.issues.length > 0) {
    throw new TemplateInstanceSchemaError(
      validated.issues.map(({ finding }) => finding),
    );
  }
  const host = validated.recognized?.host;
  if (host === undefined) {
    throw new TemplateInstanceSchemaError([
      "release identity is outside exact evidence",
    ]);
  }
  const release = input.release as RecordValue;
  const expected = hostCompatibility(host);
  return {
    schemaVersion: TEMPLATE_INSTANCE_SCHEMA_VERSION,
    versions: {
      pack: CURRENT_TEMPLATE_INSTANCE_VERSIONS.pack,
      cli: CURRENT_TEMPLATE_INSTANCE_VERSIONS.cli,
      template: expected.templateVersion,
      workflowSchema: CURRENT_TEMPLATE_INSTANCE_VERSIONS.workflowSchema,
      compatibilitySet: CURRENT_TEMPLATE_INSTANCE_VERSIONS.compatibilitySet,
    },
    release: {
      version: expected.templateVersion,
      tag: expected.templateTag,
      ...(typeof release.sourceCommit === "string"
        ? { sourceCommit: release.sourceCommit }
        : {}),
      ...(typeof release.sourceChecksum === "string"
        ? { sourceChecksum: release.sourceChecksum }
        : {}),
    },
    compatibility: TEMPLATE_INSTANCE_COMPATIBILITY,
    support: {
      state: expected.supportState,
      deprecationDate: expected.deprecationDate,
      releaseAvailability: expected.releaseAvailability,
      releaseEvidence: expected.releaseEvidence,
    },
    provenance: TEMPLATE_INSTANCE_PROVENANCE,
    ...canonicalExtensions(input),
  };
};

export const parseTemplateInstanceText = (raw: string): TemplateInstance => {
  let input: unknown;
  try {
    input = JSON.parse(raw) as unknown;
  } catch {
    throw new TemplateInstanceSchemaError(["file must contain valid JSON"]);
  }
  return parseTemplateInstance(input);
};

export const serializeTemplateInstance = (instance: TemplateInstance): string =>
  `${JSON.stringify(parseTemplateInstance(instance), null, 2)}\n`;

export const templateInstanceSchemaProvider: TemplateInstanceSchemaProvider =
  Object.freeze({
    schemaVersion: TEMPLATE_INSTANCE_SCHEMA_VERSION,
    versions: CURRENT_TEMPLATE_INSTANCE_VERSIONS,
    provenance: TEMPLATE_INSTANCE_PROVENANCE,
    compatibility: TEMPLATE_INSTANCE_COMPATIBILITY,
    parse: parseTemplateInstance,
    parseText: parseTemplateInstanceText,
    serialize: serializeTemplateInstance,
    resolve: resolveTemplateInstanceCompatibility,
  });

export * from "./providerPosture.js";
