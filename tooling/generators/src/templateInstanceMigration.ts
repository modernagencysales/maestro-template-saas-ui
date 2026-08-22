export const TEMPLATE_INSTANCE_MIGRATION_IDS = Object.freeze([
  "template-instance/0-to-1",
  "template-instance/1-to-2",
] as const);

type TemplateInstanceMigrationId =
  (typeof TEMPLATE_INSTANCE_MIGRATION_IDS)[number];

type HostCompatibility = {
  readonly templateVersion: string;
  readonly templateTag: string;
  readonly packRange: string;
  readonly cliRange: string;
  readonly supportState: "supported" | "planned";
  readonly deprecationDate: string | null;
  readonly releaseAvailability: "unavailable";
  readonly releaseEvidence: "workspace-only" | "fixture-only";
};

type VersionFacts = {
  readonly pack: string;
  readonly cli: string;
  readonly template: string;
  readonly workflowSchema: number;
  readonly compatibilitySet: number;
};

type ResolutionPacket = {
  readonly status: "compatible" | "migratable" | "unsupported" | "newer";
  readonly code: string;
  readonly safeToContinueReadOnly: true;
  readonly recovery: { readonly kind: string; readonly action: string };
  readonly [key: string]: unknown;
};

export interface TemplateInstanceMigrationProvider<
  Instance extends Readonly<Record<string, unknown>> = Readonly<
    Record<string, unknown>
  >,
> {
  readonly schemaVersion: number;
  readonly versions: VersionFacts;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly compatibility: {
    readonly current: HostCompatibility;
    readonly previous: HostCompatibility;
  };
  readonly parse: (input: unknown) => Instance;
  readonly serialize: (instance: Instance) => string;
  readonly resolve: (input: unknown) => ResolutionPacket;
}

type CompatibilityProvider = Pick<
  TemplateInstanceMigrationProvider,
  "compatibility"
>;

export type TemplateInstanceMigrationResult<
  Instance extends Readonly<Record<string, unknown>>,
> =
  | {
      readonly ok: true;
      readonly fromSchemaVersion: 0 | 1 | 2;
      readonly toSchemaVersion: number;
      readonly appliedMigrations: readonly TemplateInstanceMigrationId[];
      readonly resolution: ResolutionPacket;
      readonly instance: Instance;
    }
  | {
      readonly ok: false;
      readonly fromSchemaVersion: number | null;
      readonly toSchemaVersion: number;
      readonly appliedMigrations: readonly [];
      readonly resolution: ResolutionPacket;
      readonly original: unknown;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const schemaVersionOf = (input: Record<string, unknown>): number | null => {
  if (input.schemaVersion === undefined) return 0;
  return typeof input.schemaVersion === "number" &&
    Number.isFinite(input.schemaVersion)
    ? input.schemaVersion
    : null;
};

const releaseOf = (
  provider: CompatibilityProvider,
  input: Record<string, unknown>,
): { readonly version?: string; readonly tag?: string } => {
  if (isRecord(input.release)) {
    return {
      ...(typeof input.release.version === "string"
        ? { version: input.release.version }
        : {}),
      ...(typeof input.release.tag === "string"
        ? { tag: input.release.tag }
        : {}),
    };
  }

  const legacy = isRecord(input.upgradeCompatibility)
    ? input.upgradeCompatibility
    : {};
  const legacyVersion =
    typeof legacy.templateVersion === "string"
      ? legacy.templateVersion
      : undefined;
  if (legacyVersion === provider.compatibility.previous.templateVersion) {
    return {
      version: provider.compatibility.previous.templateVersion,
      tag: provider.compatibility.previous.templateTag,
    };
  }
  if (
    legacyVersion === undefined ||
    legacyVersion === "unreleased" ||
    legacyVersion === provider.compatibility.current.templateVersion
  ) {
    return {
      version: provider.compatibility.current.templateVersion,
      tag: provider.compatibility.current.templateTag,
    };
  }
  return { version: legacyVersion };
};

const migrateZeroToOne = (
  provider: CompatibilityProvider,
  input: Record<string, unknown>,
): Record<string, unknown> => ({
  ...input,
  schemaVersion: 1,
  release: {
    ...(isRecord(input.release) ? input.release : {}),
    ...releaseOf(provider, input),
  },
});

const hostFor = (
  provider: CompatibilityProvider,
  release: Record<string, unknown>,
): HostCompatibility =>
  release.version === provider.compatibility.previous.templateVersion &&
  release.tag === provider.compatibility.previous.templateTag
    ? provider.compatibility.previous
    : provider.compatibility.current;

export const createTemplateInstanceMigration = <
  Instance extends Readonly<Record<string, unknown>>,
>(
  provider: TemplateInstanceMigrationProvider<Instance>,
) => {
  const migrateOneToTwo = (input: Record<string, unknown>): Instance => {
    const release = isRecord(input.release) ? input.release : {};
    const host = hostFor(provider, release);
    return provider.parse({
      ...input,
      schemaVersion: provider.schemaVersion,
      versions: {
        ...provider.versions,
        template: host.templateVersion,
      },
      release: {
        ...release,
        version: host.templateVersion,
        tag: host.templateTag,
      },
      compatibility: provider.compatibility,
      support: {
        state: host.supportState,
        deprecationDate: host.deprecationDate,
        releaseAvailability: host.releaseAvailability,
        releaseEvidence: host.releaseEvidence,
      },
      provenance: provider.provenance,
    });
  };

  const migrateTemplateInstance = (
    input: unknown,
    // eslint-disable-next-line complexity -- AP-008 tracks splitting migration-result compatibility branches.
  ): TemplateInstanceMigrationResult<Instance> => {
    if (!isRecord(input)) {
      return {
        ok: false,
        fromSchemaVersion: null,
        toSchemaVersion: provider.schemaVersion,
        appliedMigrations: [],
        resolution: provider.resolve(input),
        original: input,
      };
    }

    const fromSchemaVersion = schemaVersionOf(input);
    const beforeResolution = provider.resolve(input);
    if (
      beforeResolution.status === "newer" ||
      beforeResolution.status === "unsupported" ||
      fromSchemaVersion === null ||
      !Number.isInteger(fromSchemaVersion) ||
      fromSchemaVersion < 0 ||
      fromSchemaVersion > provider.schemaVersion
    ) {
      return {
        ok: false,
        fromSchemaVersion,
        toSchemaVersion: provider.schemaVersion,
        appliedMigrations: [],
        resolution: beforeResolution,
        original: input,
      };
    }

    if (fromSchemaVersion === provider.schemaVersion) {
      const instance = provider.parse(input);
      return {
        ok: true,
        fromSchemaVersion: fromSchemaVersion as 2,
        toSchemaVersion: provider.schemaVersion,
        appliedMigrations: [],
        resolution: provider.resolve(instance),
        instance,
      };
    }

    const versionOne =
      fromSchemaVersion === 0 ? migrateZeroToOne(provider, input) : input;
    const instance = migrateOneToTwo(versionOne);
    return {
      ok: true,
      fromSchemaVersion: fromSchemaVersion as 0 | 1,
      toSchemaVersion: provider.schemaVersion,
      appliedMigrations:
        fromSchemaVersion === 0
          ? TEMPLATE_INSTANCE_MIGRATION_IDS
          : [TEMPLATE_INSTANCE_MIGRATION_IDS[1]],
      resolution: provider.resolve(instance),
      instance,
    };
  };

  const serializeTemplateInstanceMigration = (
    result: Extract<
      TemplateInstanceMigrationResult<Instance>,
      { readonly ok: true }
    >,
  ): string => provider.serialize(result.instance);

  return Object.freeze({
    migrateTemplateInstance,
    serializeTemplateInstanceMigration,
  });
};
