import { createHash } from "node:crypto";

export const SUPPORT_BUNDLE_VERSION = 1 as const;
export const DEFAULT_SUPPORT_BUNDLE_PATH =
  ".maestro/support/support-bundle.json" as const;
export const SUPPORT_BUNDLE_MAX_SOURCE_BYTES = 256 * 1024;
export const SUPPORT_BUNDLE_PRODUCT_VERSION = "unavailable" as const;

export const SUPPORT_BUNDLE_PRODUCT_VERSIONS = Object.freeze({
  agentPack: SUPPORT_BUNDLE_PRODUCT_VERSION,
  cli: SUPPORT_BUNDLE_PRODUCT_VERSION,
  template: SUPPORT_BUNDLE_PRODUCT_VERSION,
  node: process.versions.node,
});

export type SupportHostKind = "claude-code" | "codex" | "other" | "unknown";
export type SupportProviderKind = "convex" | "model" | "other";
export type SupportProviderPosture =
  "not-configured" | "local-only" | "external-user-selected" | "unknown";

export type SupportBundleSource = {
  readonly host: { readonly kind: SupportHostKind };
  readonly providers: readonly {
    readonly kind: SupportProviderKind;
    readonly posture: SupportProviderPosture;
  }[];
};

export type SupportBundle = {
  readonly schemaVersion: typeof SUPPORT_BUNDLE_VERSION;
  readonly bundleId: `support_bundle_sha256:${string}`;
  readonly versions: typeof SUPPORT_BUNDLE_PRODUCT_VERSIONS;
  readonly posture: {
    readonly host: SupportHostKind;
    readonly providers: SupportBundleSource["providers"];
  };
  readonly handling: {
    readonly automaticUpload: false;
    readonly containsCustomerData: false;
    readonly containsEnvironmentValues: false;
    readonly containsSecrets: false;
  };
};

export type SupportBundlePreview = {
  readonly output: string;
  readonly previewFingerprint: `support_preview_sha256:${string}`;
  readonly bundle: SupportBundle;
  readonly serialized: string;
  readonly bytes: number;
};

export type SupportBundleContractErrorCode =
  | "SUPPORT_BUNDLE_INVALID_FIELD"
  | "SUPPORT_BUNDLE_INVALID_OUTPUT"
  | "SUPPORT_BUNDLE_SOURCE_TOO_LARGE"
  | "SUPPORT_BUNDLE_UNKNOWN_FIELD";

export class SupportBundleContractError extends Error {
  constructor(
    readonly code: SupportBundleContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SupportBundleContractError";
  }
}

const outputPath = /^\.maestro\/support\/[a-z0-9][a-z0-9._-]{0,79}\.json$/;
const hostKinds = new Set<SupportHostKind>([
  "claude-code",
  "codex",
  "other",
  "unknown",
]);
const providerKinds = new Set<SupportProviderKind>([
  "convex",
  "model",
  "other",
]);
const providerPostures = new Set<SupportProviderPosture>([
  "not-configured",
  "local-only",
  "external-user-selected",
  "unknown",
]);

export function createSupportBundlePreview(
  input: unknown,
  options: { readonly output?: string } = {},
): SupportBundlePreview {
  const parsedOptions = exactOptionalRecord(options, ["output"]);
  const output = parsedOptions.output ?? DEFAULT_SUPPORT_BUNDLE_PATH;
  if (!isValidSupportBundleOutput(output)) {
    throw new SupportBundleContractError(
      "SUPPORT_BUNDLE_INVALID_OUTPUT",
      "Support bundle output must be one bounded .maestro/support JSON file.",
    );
  }
  const source = parseSupportBundleSource(input);
  const payload = {
    schemaVersion: SUPPORT_BUNDLE_VERSION,
    versions: SUPPORT_BUNDLE_PRODUCT_VERSIONS,
    posture: { host: source.host.kind, providers: source.providers },
    handling: {
      automaticUpload: false,
      containsCustomerData: false,
      containsEnvironmentValues: false,
      containsSecrets: false,
    },
  } as const;
  const bundle: SupportBundle = {
    schemaVersion: SUPPORT_BUNDLE_VERSION,
    bundleId: `support_bundle_sha256:${sha256(canonicalJson(payload))}`,
    versions: SUPPORT_BUNDLE_PRODUCT_VERSIONS,
    posture: payload.posture,
    handling: payload.handling,
  };
  const serialized = canonicalJson(bundle);
  return {
    output,
    previewFingerprint: `support_preview_sha256:${sha256(`${output}\0${serialized}`)}`,
    bundle,
    serialized,
    bytes: Buffer.byteLength(serialized, "utf8"),
  };
}

export function isValidSupportBundleOutput(output: unknown): output is string {
  return (
    typeof output === "string" &&
    outputPath.test(output) &&
    !output.includes("..") &&
    !output.includes("\\")
  );
}

function parseSupportBundleSource(input: unknown): SupportBundleSource {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(input);
  } catch {
    invalidField("Support bundle source must be bounded JSON.");
  }
  if (serialized === undefined)
    invalidField("Support bundle source must be bounded JSON.");
  if (Buffer.byteLength(serialized, "utf8") > SUPPORT_BUNDLE_MAX_SOURCE_BYTES) {
    throw new SupportBundleContractError(
      "SUPPORT_BUNDLE_SOURCE_TOO_LARGE",
      "Support bundle source exceeds the bounded input limit.",
    );
  }

  const source = exactRecord(input, ["host", "providers"]);
  const host = exactRecord(source.host, ["kind"]);
  if (!hostKinds.has(host.kind as SupportHostKind))
    invalidField("Support host posture is invalid.");
  if (!Array.isArray(source.providers) || source.providers.length > 16)
    invalidField("Support provider posture is invalid.");

  const providers = [
    ...new Map(
      source.providers.map((value) => {
        const provider = parseProvider(value);
        return [canonicalJson(provider), provider] as const;
      }),
    ).values(),
  ].sort((left, right) =>
    canonicalJson(left).localeCompare(canonicalJson(right)),
  );
  return {
    host: { kind: host.kind as SupportHostKind },
    providers,
  };
}

function parseProvider(
  value: unknown,
): SupportBundleSource["providers"][number] {
  const provider = exactRecord(value, ["kind", "posture"]);
  if (
    !providerKinds.has(provider.kind as SupportProviderKind) ||
    !providerPostures.has(provider.posture as SupportProviderPosture)
  ) {
    invalidField("Support provider posture is invalid.");
  }
  return {
    kind: provider.kind as SupportProviderKind,
    posture: provider.posture as SupportProviderPosture,
  };
}

function exactRecord(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  const record = exactOptionalRecord(value, allowed);
  if (allowed.some((key) => !Object.hasOwn(record, key)))
    invalidField("Support bundle source is missing an allowlisted field.");
  return record;
}

function exactOptionalRecord(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalidField("Support bundle fields must use the public object schema.");
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) {
    throw new SupportBundleContractError(
      "SUPPORT_BUNDLE_UNKNOWN_FIELD",
      "Support bundle source contains a field outside the public allowlist.",
    );
  }
  return value as Record<string, unknown>;
}

function invalidField(message: string): never {
  throw new SupportBundleContractError("SUPPORT_BUNDLE_INVALID_FIELD", message);
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortJson(nested)]),
    );
  }
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
