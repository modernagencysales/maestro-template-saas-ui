export type CustomerPathOwnership =
  | "template-owned"
  | "customer-extension"
  | "generated"
  | "local-only"
  | "factory-only";

export type CustomerReleasePath = {
  readonly path: string;
  readonly ownership: CustomerPathOwnership;
  readonly action: "copy" | "generate" | "omit";
  readonly upgrade: "replace" | "preserve" | "regenerate" | "remove";
};

export type CustomerReleaseManifest = {
  readonly $schema: string;
  readonly schemaVersion: 1;
  readonly release: {
    readonly version: string;
    readonly tag: string;
    readonly sourceCommit: string;
    readonly sourceChecksum: string;
  };
  readonly compatibility: {
    readonly cli: string;
    readonly agentPack: string;
  };
  readonly paths: readonly CustomerReleasePath[];
  readonly expectedHashes: Readonly<Record<string, string>>;
  readonly extensionSeams: readonly {
    readonly path: string;
    readonly description: string;
  }[];
};

export class CustomerReleaseManifestError extends Error {
  readonly findings: readonly string[];

  constructor(findings: readonly string[]) {
    super(findings.join("\n"));
    this.name = "CustomerReleaseManifestError";
    this.findings = findings;
  }
}

const schemaPath =
  "../../schemas/maestro-customer-release-manifest.schema.json";
const semver = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const commit = /^[0-9a-f]{40}$/;
const sha256 = /^sha256:[0-9a-f]{64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSafePath = (value: string): boolean =>
  value.length > 0 &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  !value.split("/").includes("..");

const rejectUnknown = (
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
  findings: string[],
): void => {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) findings.push(`Unknown ${label} field: ${key}`);
  }
};

const requiredString = (
  value: Record<string, unknown>,
  key: string,
  label: string,
  findings: string[],
): string => {
  const field = value[key];
  if (typeof field === "string" && field.length > 0) return field;
  findings.push(`${label}.${key} must be a non-empty string`);
  return "";
};

const parsePath = (
  value: unknown,
  index: number,
  findings: string[],
): CustomerReleasePath | undefined => {
  if (!isRecord(value)) {
    findings.push(`paths[${index}] must be an object`);
    return undefined;
  }
  rejectUnknown(
    value,
    ["path", "ownership", "action", "upgrade"],
    `paths[${index}]`,
    findings,
  );
  const path = requiredString(value, "path", `paths[${index}]`, findings);
  if (!isSafePath(path)) findings.push(`Unsafe manifest path: ${path}`);
  const ownership = value.ownership;
  const action = value.action;
  const upgrade = value.upgrade;
  const combinations: readonly CustomerReleasePath[] = [
    { path, ownership: "template-owned", action: "copy", upgrade: "replace" },
    {
      path,
      ownership: "customer-extension",
      action: "copy",
      upgrade: "preserve",
    },
    { path, ownership: "generated", action: "generate", upgrade: "regenerate" },
    { path, ownership: "local-only", action: "omit", upgrade: "preserve" },
    { path, ownership: "factory-only", action: "omit", upgrade: "remove" },
  ];
  const match = combinations.find(
    (candidate) =>
      candidate.ownership === ownership &&
      candidate.action === action &&
      candidate.upgrade === upgrade,
  );
  if (!match) {
    findings.push(`Invalid ownership/action/upgrade posture for path: ${path}`);
  }
  return match;
};

export function validateCustomerReleaseManifest(
  input: unknown,
  shippedFiles: Readonly<Record<string, string>>,
): CustomerReleaseManifest {
  const findings: string[] = [];
  if (!isRecord(input))
    throw new CustomerReleaseManifestError(["Manifest must be an object"]);
  rejectUnknown(
    input,
    [
      "$schema",
      "schemaVersion",
      "release",
      "compatibility",
      "paths",
      "expectedHashes",
      "extensionSeams",
    ],
    "manifest",
    findings,
  );
  if (input.$schema !== schemaPath)
    findings.push(`Manifest $schema must be ${schemaPath}`);
  if (input.schemaVersion !== 1) findings.push("schemaVersion must be 1");

  const release = isRecord(input.release) ? input.release : {};
  if (!isRecord(input.release)) findings.push("release must be an object");
  rejectUnknown(
    release,
    ["version", "tag", "sourceCommit", "sourceChecksum"],
    "release",
    findings,
  );
  const version = requiredString(release, "version", "release", findings);
  const tag = requiredString(release, "tag", "release", findings);
  const sourceCommit = requiredString(
    release,
    "sourceCommit",
    "release",
    findings,
  );
  const sourceChecksum = requiredString(
    release,
    "sourceChecksum",
    "release",
    findings,
  );
  if (!semver.test(version)) findings.push("release.version must be SemVer");
  if (tag !== `maestro-template-v${version}`)
    findings.push("release.tag must immutably match release.version");
  if (!commit.test(sourceCommit))
    findings.push(
      "release.sourceCommit must be a 40-character lowercase Git SHA",
    );
  if (!sha256.test(sourceChecksum))
    findings.push("release.sourceChecksum must be SHA-256");

  const compatibility = isRecord(input.compatibility)
    ? input.compatibility
    : {};
  if (!isRecord(input.compatibility))
    findings.push("compatibility must be an object");
  rejectUnknown(compatibility, ["cli", "agentPack"], "compatibility", findings);
  const cli = requiredString(compatibility, "cli", "compatibility", findings);
  const agentPack = requiredString(
    compatibility,
    "agentPack",
    "compatibility",
    findings,
  );

  const rawPaths = Array.isArray(input.paths) ? input.paths : [];
  if (!Array.isArray(input.paths) || rawPaths.length === 0)
    findings.push("paths must be a non-empty array");
  const paths = rawPaths
    .map((value, index) => parsePath(value, index, findings))
    .filter((value): value is CustomerReleasePath => value !== undefined);
  const classifications = new Map<string, CustomerReleasePath>();
  for (const entry of paths) {
    if (classifications.has(entry.path))
      findings.push(`Duplicate path classification: ${entry.path}`);
    classifications.set(entry.path, entry);
  }

  const rawHashes = isRecord(input.expectedHashes) ? input.expectedHashes : {};
  if (!isRecord(input.expectedHashes))
    findings.push("expectedHashes must be an object");
  const expectedHashes: Record<string, string> = {};
  for (const [path, hash] of Object.entries(rawHashes)) {
    if (!isSafePath(path) || typeof hash !== "string" || !sha256.test(hash)) {
      findings.push(`Invalid expected hash entry: ${path}`);
    } else expectedHashes[path] = hash;
  }

  for (const [path, actualHash] of Object.entries(shippedFiles)) {
    const classification = classifications.get(path);
    if (!classification) findings.push(`Unclassified shipped path: ${path}`);
    else if (classification.action !== "copy")
      findings.push(`Shipped path must use copy action: ${path}`);
    if (!sha256.test(actualHash))
      findings.push(`Invalid actual shipped hash: ${path}`);
    if (expectedHashes[path] !== actualHash)
      findings.push(`Hash mismatch for shipped path: ${path}`);
  }
  for (const entry of paths.filter(({ action }) => action === "copy")) {
    if (!(entry.path in shippedFiles))
      findings.push(`Copied path missing from shipped release: ${entry.path}`);
    if (!(entry.path in expectedHashes))
      findings.push(`Copied path missing expected hash: ${entry.path}`);
  }
  for (const path of Object.keys(expectedHashes)) {
    if (classifications.get(path)?.action !== "copy")
      findings.push(`Expected hash must reference a copied path: ${path}`);
  }

  const rawSeams = Array.isArray(input.extensionSeams)
    ? input.extensionSeams
    : [];
  if (!Array.isArray(input.extensionSeams))
    findings.push("extensionSeams must be an array");
  const extensionSeams = rawSeams.flatMap((value, index) => {
    if (!isRecord(value)) {
      findings.push(`extensionSeams[${index}] must be an object`);
      return [];
    }
    rejectUnknown(
      value,
      ["path", "description"],
      `extensionSeams[${index}]`,
      findings,
    );
    const path = requiredString(
      value,
      "path",
      `extensionSeams[${index}]`,
      findings,
    );
    const description = requiredString(
      value,
      "description",
      `extensionSeams[${index}]`,
      findings,
    );
    if (classifications.get(path)?.ownership !== "customer-extension") {
      findings.push(
        `Extension seam must reference a customer-extension path: ${path}`,
      );
    }
    return [{ path, description }];
  });

  if (findings.length > 0) throw new CustomerReleaseManifestError(findings);
  return {
    $schema: schemaPath,
    schemaVersion: 1,
    release: { version, tag, sourceCommit, sourceChecksum },
    compatibility: { cli, agentPack },
    paths,
    expectedHashes,
    extensionSeams,
  };
}
