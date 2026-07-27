export const PROVIDER_POSTURE_SCHEMA_VERSION = 1 as const;

export const PROVIDER_ENVIRONMENTS = [
  "fake",
  "local",
  "dev",
  "preview",
  "staging",
  "production",
] as const;

export const PROVIDER_POSTURE_STATES = [
  "fake",
  "seam",
  "configured",
  "verified",
  "disabled",
  "unavailable",
] as const;

export type ProviderEnvironment = (typeof PROVIDER_ENVIRONMENTS)[number];
export type ProviderPostureState = (typeof PROVIDER_POSTURE_STATES)[number];

export type ProviderPostureEvidenceRef = {
  readonly kind: "configuration" | "verification";
  readonly ref: `receipt:${string}` | `fixture:${string}`;
  readonly secretNames: readonly string[];
  readonly expiresAt: string;
};

export type ProviderEnvironmentPosture = {
  readonly state: ProviderPostureState;
  readonly evidence: readonly ProviderPostureEvidenceRef[];
};

export type ProviderPosture = {
  readonly schemaVersion: typeof PROVIDER_POSTURE_SCHEMA_VERSION;
  readonly providers: Readonly<
    Record<
      string,
      {
        readonly environments: Readonly<
          Record<ProviderEnvironment, ProviderEnvironmentPosture>
        >;
      }
    >
  >;
};

export type LegacyGlobalProviderMode = "fake" | "test" | "live";

export class ProviderPostureSchemaError extends Error {
  readonly code = "PROVIDER_POSTURE_SCHEMA_INVALID" as const;

  constructor(readonly finding: string) {
    super(`Invalid provider posture: ${finding}`);
    this.name = "ProviderPostureSchemaError";
  }
}

type RecordValue = Record<string, unknown>;

const stateSet = new Set<string>(PROVIDER_POSTURE_STATES);
const evidenceKinds = new Set(["configuration", "verification"]);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const parseProviderPosture = (input: unknown): ProviderPosture => {
  const root = exactRecord(input, ["schemaVersion", "providers"], "posture");
  requireValue(
    root.schemaVersion === PROVIDER_POSTURE_SCHEMA_VERSION,
    `schemaVersion must be ${String(PROVIDER_POSTURE_SCHEMA_VERSION)}`,
  );
  const rawProviders = record(root.providers, "providers must be an object");
  const providers = Object.fromEntries(
    Object.keys(rawProviders)
      .sort(compareCodeUnits)
      .map((providerId) => [
        parseProviderId(providerId),
        parseProvider(rawProviders[providerId], providerId),
      ]),
  );
  return { schemaVersion: PROVIDER_POSTURE_SCHEMA_VERSION, providers };
};

export const serializeProviderPosture = (posture: ProviderPosture): string =>
  `${JSON.stringify(parseProviderPosture(posture), null, 2)}\n`;

export const isProviderVerifiedFor = (
  posture: ProviderPosture,
  providerId: string,
  environment: ProviderEnvironment,
  now: Date,
): boolean => {
  const environmentPosture =
    posture.providers[providerId]?.environments[environment];
  if (environmentPosture?.state !== "verified") return false;
  const nowMs = now.getTime();
  return environmentPosture.evidence.some(
    ({ kind, expiresAt }) =>
      kind === "verification" && Date.parse(expiresAt) > nowMs,
  );
};

export const migrateLegacyGlobalProviderPosture = (input: {
  readonly providerMode: LegacyGlobalProviderMode;
  readonly providerIds: readonly string[];
}): ProviderPosture => {
  requireValue(
    input.providerMode === "fake" ||
      input.providerMode === "test" ||
      input.providerMode === "live",
    "legacy providerMode is unknown",
  );
  const providers: Record<
    string,
    { environments: Record<ProviderEnvironment, ProviderEnvironmentPosture> }
  > = {};
  for (const rawProviderId of [...input.providerIds].sort(compareCodeUnits)) {
    const providerId = parseProviderId(rawProviderId);
    requireValue(
      providers[providerId] === undefined,
      `providerIds contains duplicate ${providerId}`,
    );
    providers[providerId] = {
      environments: Object.fromEntries(
        PROVIDER_ENVIRONMENTS.map((environment) => [
          environment,
          {
            state: migratedState(input.providerMode, environment),
            evidence: [],
          },
        ]),
      ) as unknown as Record<ProviderEnvironment, ProviderEnvironmentPosture>,
    };
  }
  return parseProviderPosture({
    schemaVersion: PROVIDER_POSTURE_SCHEMA_VERSION,
    providers,
  });
};

const migratedState = (
  mode: LegacyGlobalProviderMode,
  environment: ProviderEnvironment,
): ProviderPostureState => {
  if (environment === "fake") return "fake";
  if (environment === "local") return mode === "fake" ? "fake" : "seam";
  if (environment === "dev") {
    if (mode === "fake") return "unavailable";
    return mode === "test" ? "seam" : "configured";
  }
  return "unavailable";
};

const parseProvider = (
  input: unknown,
  providerId: string,
): {
  readonly environments: Record<
    ProviderEnvironment,
    ProviderEnvironmentPosture
  >;
} => {
  const provider = exactRecord(
    input,
    ["environments"],
    `providers.${providerId}`,
  );
  const rawEnvironments = exactRecord(
    provider.environments,
    PROVIDER_ENVIRONMENTS,
    `providers.${providerId}.environments`,
  );
  const environments = Object.fromEntries(
    PROVIDER_ENVIRONMENTS.map((environment) => [
      environment,
      parseEnvironment(rawEnvironments[environment], providerId, environment),
    ]),
  ) as Record<ProviderEnvironment, ProviderEnvironmentPosture>;
  return { environments };
};

const parseEnvironment = (
  input: unknown,
  providerId: string,
  environment: ProviderEnvironment,
): ProviderEnvironmentPosture => {
  const path = `providers.${providerId}.environments.${environment}`;
  const value = exactRecord(input, ["state", "evidence"], path);
  requireValue(
    typeof value.state === "string" && stateSet.has(value.state),
    `${path}.state is unknown`,
  );
  const evidence = array(value.evidence, `${path}.evidence must be an array`)
    .map((entry, index) =>
      parseEvidence(entry, `${path}.evidence.${String(index)}`),
    )
    .sort((left, right) => compareCodeUnits(left.ref, right.ref));
  const references = new Set<string>();
  for (const entry of evidence) {
    requireValue(
      !references.has(entry.ref),
      `${path}.evidence contains duplicate ref ${entry.ref}`,
    );
    references.add(entry.ref);
  }
  if (value.state === "verified") {
    requireValue(
      evidence.some(({ kind }) => kind === "verification"),
      `${path}.verified requires verification evidence`,
    );
  }
  return { state: value.state as ProviderPostureState, evidence };
};

const parseEvidence = (
  input: unknown,
  path: string,
): ProviderPostureEvidenceRef => {
  const value = exactRecord(
    input,
    ["kind", "ref", "secretNames", "expiresAt"],
    path,
  );
  requireValue(
    typeof value.kind === "string" && evidenceKinds.has(value.kind),
    `${path}.kind is unknown`,
  );
  requireValue(
    typeof value.ref === "string" &&
      /^(?:receipt|fixture):[A-Za-z0-9._/-]+$/u.test(value.ref),
    `${path}.ref is invalid`,
  );
  const secretNames = array(
    value.secretNames,
    `${path}.secretNames must be an array`,
  ).map((entry, index) => {
    requireValue(
      typeof entry === "string" && /^[A-Z][A-Z0-9_]*$/u.test(entry),
      `${path}.secretNames.${String(index)} must contain a secret name only`,
    );
    return entry;
  });
  requireValue(
    new Set(secretNames).size === secretNames.length,
    `${path}.secretNames contains duplicates`,
  );
  requireValue(
    typeof value.expiresAt === "string" &&
      canonicalTimestamp(value.expiresAt) === value.expiresAt,
    `${path}.expiresAt must be a canonical timestamp`,
  );
  return {
    kind: value.kind as ProviderPostureEvidenceRef["kind"],
    ref: value.ref as ProviderPostureEvidenceRef["ref"],
    secretNames: [...secretNames].sort(compareCodeUnits),
    expiresAt: value.expiresAt,
  };
};

const parseProviderId = (value: string): string => {
  requireValue(
    /^[a-z][a-z0-9-]*$/u.test(value),
    `provider ID ${value} is invalid`,
  );
  return value;
};

const exactRecord = (
  input: unknown,
  keys: readonly string[],
  path: string,
): RecordValue => {
  const value = record(input, `${path} must be an object`);
  const expected = new Set(keys);
  const unknown = Object.keys(value)
    .filter((key) => !expected.has(key))
    .sort(compareCodeUnits)[0];
  requireValue(
    unknown === undefined,
    `${path} has unknown field ${unknown ?? ""}`,
  );
  const missing = [...keys]
    .sort(compareCodeUnits)
    .find((key) => !Object.hasOwn(value, key));
  requireValue(
    missing === undefined,
    `${path} is missing field ${missing ?? ""}`,
  );
  return value;
};

const record = (input: unknown, message: string): RecordValue => {
  requireValue(
    input !== null && typeof input === "object" && !Array.isArray(input),
    message,
  );
  return input as RecordValue;
};

const array = (input: unknown, message: string): readonly unknown[] => {
  requireValue(Array.isArray(input), message);
  return input as readonly unknown[];
};

const canonicalTimestamp = (value: string): string | undefined => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
};

const requireValue: (
  condition: boolean,
  finding: string,
) => asserts condition = (condition, finding) => {
  if (!condition) throw new ProviderPostureSchemaError(finding);
};
