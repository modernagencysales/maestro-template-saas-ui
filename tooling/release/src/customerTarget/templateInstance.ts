type VersionFacts = {
  readonly pack: string;
  readonly cli: string;
  readonly template: string;
  readonly workflowSchema: number;
  readonly compatibilitySet: number;
};

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

export type ReleaseTemplateInstanceResolution = {
  readonly status: "compatible" | "migratable" | "unsupported" | "newer";
  readonly code: string;
  readonly safeToContinueReadOnly: true;
  readonly recovery: {
    readonly kind: string;
    readonly action: string;
  };
  readonly [key: string]: unknown;
};

export interface ReleaseTemplateInstanceSchemaProvider<
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
  readonly parseText: (raw: string) => Instance;
  readonly serialize: (instance: Instance) => string;
  readonly resolve: (input: unknown) => ReleaseTemplateInstanceResolution;
}

export type ReleaseTemplateInstanceMigration<
  Instance extends Readonly<Record<string, unknown>> = Readonly<
    Record<string, unknown>
  >,
> = {
  readonly migrateTemplateInstance: (input: unknown) =>
    | {
        readonly ok: true;
        readonly resolution: ReleaseTemplateInstanceResolution;
        readonly instance: Instance;
      }
    | {
        readonly ok: false;
        readonly resolution: ReleaseTemplateInstanceResolution;
      };
};

export interface ReleaseTemplateInstanceConsumer {
  readonly prepare: (raw: string) => string;
}

export class ReleaseTemplateInstanceCompatibilityError extends Error {
  constructor(
    readonly resolution: ReleaseTemplateInstanceResolution,
    message = `${resolution.code}: ${resolution.recovery.action}`,
  ) {
    super(message);
    this.name = "ReleaseTemplateInstanceCompatibilityError";
  }
}

export const createReleaseTemplateInstanceConsumer = <
  Instance extends Readonly<Record<string, unknown>>,
>(
  schema: ReleaseTemplateInstanceSchemaProvider<Instance>,
  migration: ReleaseTemplateInstanceMigration<Instance>,
): ReleaseTemplateInstanceConsumer => ({
  prepare: (raw) => {
    let input: unknown;
    try {
      input = JSON.parse(raw) as unknown;
    } catch {
      const resolution = schema.resolve({});
      throw new ReleaseTemplateInstanceCompatibilityError(
        resolution,
        "TEMPLATE_INSTANCE_JSON_INVALID: template-instance.json must contain valid JSON.",
      );
    }

    const migrated = migration.migrateTemplateInstance(input);
    if (!migrated.ok) {
      throw new ReleaseTemplateInstanceCompatibilityError(migrated.resolution);
    }
    if (migrated.resolution.status !== "compatible") {
      throw new ReleaseTemplateInstanceCompatibilityError(migrated.resolution);
    }
    return schema.serialize(schema.parse(migrated.instance));
  },
});
