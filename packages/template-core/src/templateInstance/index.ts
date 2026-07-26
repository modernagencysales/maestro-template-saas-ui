export const TEMPLATE_INSTANCE_SCHEMA_VERSION = 2 as const;
export const TEMPLATE_INSTANCE_COMPATIBILITY_SET_VERSION = 1 as const;

export const CURRENT_TEMPLATE_INSTANCE_VERSIONS = Object.freeze({
  pack: "0.1.0-alpha.1",
  cli: "0.1.0-alpha.1",
  template: "0.2.0-alpha.1",
  workflowSchema: 2,
  compatibilitySet: TEMPLATE_INSTANCE_COMPATIBILITY_SET_VERSION,
} as const);

export type TemplateInstanceSupportState = "supported" | "deprecated";

export type TemplateHostCompatibility = {
  readonly templateVersion: string;
  readonly templateTag: string;
  readonly packRange: string;
  readonly cliRange: string;
  readonly supportState: TemplateInstanceSupportState;
  readonly deprecationDate: string | null;
};

const currentHostCompatibility = Object.freeze({
  templateVersion: "0.2.0-alpha.1",
  templateTag: "maestro-template-v0.2.0-alpha.1",
  packRange: ">=0.1.0-alpha.1 <0.2.0",
  cliRange: ">=0.1.0-alpha.1 <0.2.0",
  supportState: "supported",
  deprecationDate: null,
} as const satisfies TemplateHostCompatibility);

const previousHostCompatibility = Object.freeze({
  templateVersion: "0.1.0-alpha.1",
  templateTag: "maestro-template-v0.1.0-alpha.1",
  packRange: ">=0.1.0-alpha.1 <0.2.0",
  cliRange: ">=0.1.0-alpha.1 <0.2.0",
  supportState: "deprecated",
  deprecationDate: "2026-07-25",
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
  | "TEMPLATE_INSTANCE_UNSUPPORTED_RELEASE_GAP"
  | "TEMPLATE_INSTANCE_NEWER_THAN_TOOL";

export type TemplateInstanceCompatibilityInput = {
  readonly schemaVersion?: number;
  readonly versions?: Partial<TemplateInstanceVersions>;
  readonly release?: {
    readonly version?: string;
    readonly tag?: string;
  };
};

export type TemplateInstanceResolutionPacket = {
  readonly status: TemplateInstanceCompatibilityStatus;
  readonly code: TemplateInstanceCompatibilityCode;
  readonly target: {
    readonly schemaVersion: number | null;
    readonly templateVersion: string | null;
    readonly templateTag: string | null;
    readonly compatibilitySet: number | null;
  };
  readonly safeToContinueReadOnly: true;
  readonly lastSupported: {
    readonly packVersion: string;
    readonly cliVersion: string;
    readonly templateVersion: string;
    readonly templateTag: string;
  };
  readonly recovery:
    | {
        readonly kind: "none";
        readonly action: string;
      }
    | {
        readonly kind: "migrate";
        readonly action: string;
      }
    | {
        readonly kind: "restore-supported-tag";
        readonly action: string;
      }
    | {
        readonly kind: "use-supported-tool";
        readonly action: string;
      };
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const equalRecord = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const expectedHost = (
  templateVersion: string,
  templateTag: string,
): TemplateHostCompatibility | undefined => {
  if (
    templateVersion === currentHostCompatibility.templateVersion &&
    templateTag === currentHostCompatibility.templateTag
  ) {
    return currentHostCompatibility;
  }
  if (
    templateVersion === previousHostCompatibility.templateVersion &&
    templateTag === previousHostCompatibility.templateTag
  ) {
    return previousHostCompatibility;
  }
  return undefined;
};

export const parseTemplateInstance = (input: unknown): TemplateInstance => {
  const findings: string[] = [];
  if (!isRecord(input)) {
    throw new TemplateInstanceSchemaError([
      "template instance must be an object",
    ]);
  }

  if (input.schemaVersion !== TEMPLATE_INSTANCE_SCHEMA_VERSION) {
    findings.push(
      `schemaVersion must be ${String(TEMPLATE_INSTANCE_SCHEMA_VERSION)}`,
    );
  }
  const versions = isRecord(input.versions) ? input.versions : {};
  if (!isRecord(input.versions)) findings.push("versions must be an object");
  for (const key of ["pack", "cli", "template"] as const) {
    if (!isNonEmptyString(versions[key])) {
      findings.push(`versions.${key} must be a non-empty string`);
    }
  }
  if (
    !Number.isInteger(versions.workflowSchema) ||
    Number(versions.workflowSchema) < 1
  ) {
    findings.push("versions.workflowSchema must be a positive integer");
  }
  if (
    versions.compatibilitySet !== TEMPLATE_INSTANCE_COMPATIBILITY_SET_VERSION
  ) {
    findings.push(
      `versions.compatibilitySet must be ${String(TEMPLATE_INSTANCE_COMPATIBILITY_SET_VERSION)}`,
    );
  }

  const release = isRecord(input.release) ? input.release : {};
  if (!isRecord(input.release)) findings.push("release must be an object");
  if (!isNonEmptyString(release.version)) {
    findings.push("release.version must be a non-empty string");
  }
  if (!isNonEmptyString(release.tag)) {
    findings.push("release.tag must be a non-empty string");
  }
  if (
    isNonEmptyString(versions.template) &&
    isNonEmptyString(release.version) &&
    versions.template !== release.version
  ) {
    findings.push("versions.template must match release.version");
  }

  if (!equalRecord(input.compatibility, TEMPLATE_INSTANCE_COMPATIBILITY)) {
    findings.push("compatibility must match the canonical compatibility set");
  }
  if (!equalRecord(input.provenance, TEMPLATE_INSTANCE_PROVENANCE)) {
    findings.push("provenance must identify the canonical template schema");
  }

  const support = isRecord(input.support) ? input.support : {};
  if (!isRecord(input.support)) findings.push("support must be an object");
  const host =
    isNonEmptyString(release.version) && isNonEmptyString(release.tag)
      ? expectedHost(release.version, release.tag)
      : undefined;
  if (host === undefined) {
    findings.push("release is outside the canonical current/previous set");
  } else if (
    support.state !== host.supportState ||
    support.deprecationDate !== host.deprecationDate
  ) {
    findings.push("support must match the release support state");
  }

  if (findings.length > 0) throw new TemplateInstanceSchemaError(findings);
  return input as TemplateInstance;
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

const targetFacts = (input: TemplateInstanceCompatibilityInput) => ({
  schemaVersion:
    typeof input.schemaVersion === "number" ? input.schemaVersion : null,
  templateVersion: input.versions?.template ?? input.release?.version ?? null,
  templateTag: input.release?.tag ?? null,
  compatibilitySet:
    typeof input.versions?.compatibilitySet === "number"
      ? input.versions.compatibilitySet
      : null,
});

const packet = (
  input: TemplateInstanceCompatibilityInput,
  result: Pick<
    TemplateInstanceResolutionPacket,
    "status" | "code" | "recovery"
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
  },
  provenance: TEMPLATE_INSTANCE_PROVENANCE,
});

export const resolveTemplateInstanceCompatibility = (
  input: TemplateInstanceCompatibilityInput,
): TemplateInstanceResolutionPacket => {
  const target = targetFacts(input);
  const newerSchema =
    target.schemaVersion !== null &&
    target.schemaVersion > TEMPLATE_INSTANCE_SCHEMA_VERSION;
  const newerSet =
    target.compatibilitySet !== null &&
    target.compatibilitySet > TEMPLATE_INSTANCE_COMPATIBILITY_SET_VERSION;
  if (newerSchema || newerSet) {
    return packet(input, {
      status: "newer",
      code: "TEMPLATE_INSTANCE_NEWER_THAN_TOOL",
      recovery: {
        kind: "use-supported-tool",
        action: `Use the pack and CLI published for ${target.templateTag ?? "the target release"}, or inspect read-only with this tool.`,
      },
    });
  }

  const isCurrentRelease =
    target.templateVersion === currentHostCompatibility.templateVersion &&
    target.templateTag === currentHostCompatibility.templateTag;
  const hasCurrentEnvelope =
    target.schemaVersion === TEMPLATE_INSTANCE_SCHEMA_VERSION &&
    target.compatibilitySet === TEMPLATE_INSTANCE_COMPATIBILITY_SET_VERSION;
  if (isCurrentRelease && hasCurrentEnvelope) {
    return packet(input, {
      status: "compatible",
      code: "TEMPLATE_INSTANCE_COMPATIBLE",
      recovery: {
        kind: "none",
        action: "Continue with the current tool and template release.",
      },
    });
  }

  const isPreviousRelease =
    target.templateVersion === previousHostCompatibility.templateVersion &&
    target.templateTag === previousHostCompatibility.templateTag;
  if (isPreviousRelease || isCurrentRelease) {
    const startingTag =
      target.templateTag ?? previousHostCompatibility.templateTag;
    return packet(input, {
      status: "migratable",
      code: "TEMPLATE_INSTANCE_MIGRATION_AVAILABLE",
      recovery: {
        kind: "migrate",
        action: `Preview the generated template-instance migration, then upgrade from ${startingTag} to ${currentHostCompatibility.templateTag}.`,
      },
    });
  }

  return packet(input, {
    status: "unsupported",
    code: "TEMPLATE_INSTANCE_UNSUPPORTED_RELEASE_GAP",
    recovery: {
      kind: "restore-supported-tag",
      action: `Restore or recreate the target at ${previousHostCompatibility.templateTag} before using this tool.`,
    },
  });
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
