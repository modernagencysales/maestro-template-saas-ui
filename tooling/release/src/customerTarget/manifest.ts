export type CustomerPathOwnership =
  | "template-owned"
  | "customer-extension"
  | "generated"
  | "local-only"
  | "factory-only";

export type CustomerReleasePath = {
  readonly path: string;
  readonly match: "exact" | "subtree";
  readonly ownership: CustomerPathOwnership;
  readonly action: "copy" | "generate" | "omit";
  readonly upgrade: "replace" | "preserve" | "regenerate" | "remove";
};

type CustomerReleaseManifestBase = {
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

export type MaterializableCustomerReleaseManifest =
  CustomerReleaseManifestBase & {
    readonly materializationStatus: "materializable";
  };

export type CustomerReleaseManifest =
  | MaterializableCustomerReleaseManifest
  | (CustomerReleaseManifestBase & {
      readonly materializationStatus: "fixture-only";
      readonly fixtureReason: string;
    });

export type ResolvedCustomerReleaseBinding = {
  readonly tag: string;
  readonly sourceCommit: string;
  readonly sourceChecksum: string;
};

export class CustomerReleaseManifestError extends Error {
  readonly findings: readonly string[];

  constructor(findings: readonly string[]) {
    super(findings.join("\n"));
    this.name = "CustomerReleaseManifestError";
    this.findings = findings;
  }
}

export function assertMaterializableCustomerReleaseManifest(
  manifest: CustomerReleaseManifest,
  resolved: ResolvedCustomerReleaseBinding | undefined,
): asserts manifest is MaterializableCustomerReleaseManifest {
  if (manifest.materializationStatus === "fixture-only") {
    throw new CustomerReleaseManifestError([
      `Release manifest is fixture-only: ${manifest.fixtureReason}`,
    ]);
  }
  if (!resolved) {
    throw new CustomerReleaseManifestError([
      "Materializable release requires an externally resolved tag binding",
    ]);
  }
  if (
    resolved.tag !== manifest.release.tag ||
    resolved.sourceCommit !== manifest.release.sourceCommit ||
    resolved.sourceChecksum !== manifest.release.sourceChecksum
  ) {
    throw new CustomerReleaseManifestError([
      "Resolved tag, commit, or source checksum does not match the release manifest",
    ]);
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
    ["path", "match", "ownership", "action", "upgrade"],
    `paths[${index}]`,
    findings,
  );
  const path = requiredString(value, "path", `paths[${index}]`, findings);
  if (!isSafePath(path)) findings.push(`Unsafe manifest path: ${path}`);
  const pathMatch = value.match;
  if (pathMatch !== "exact" && pathMatch !== "subtree") {
    findings.push(`paths[${index}].match must be exact or subtree`);
  }
  const match = pathMatch === "subtree" ? "subtree" : "exact";
  const ownership = value.ownership;
  const action = value.action;
  const upgrade = value.upgrade;
  const combinations: readonly CustomerReleasePath[] = [
    {
      path,
      match,
      ownership: "template-owned",
      action: "copy",
      upgrade: "replace",
    },
    {
      path,
      match,
      ownership: "customer-extension",
      action: "copy",
      upgrade: "preserve",
    },
    {
      path,
      match,
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    },
    {
      path,
      match,
      ownership: "local-only",
      action: "omit",
      upgrade: "preserve",
    },
    {
      path,
      match,
      ownership: "factory-only",
      action: "omit",
      upgrade: "remove",
    },
  ];
  const combination = combinations.find(
    (candidate) =>
      candidate.ownership === ownership &&
      candidate.action === action &&
      candidate.upgrade === upgrade,
  );
  if (!combination) {
    findings.push(`Invalid ownership/action/upgrade posture for path: ${path}`);
  }
  return combination;
};

export function resolveCustomerReleasePath(
  paths: readonly CustomerReleasePath[],
  path: string,
): CustomerReleasePath | undefined {
  const exact = paths.filter(
    (entry) => entry.match === "exact" && entry.path === path,
  );
  if (exact.length > 1) {
    throw new CustomerReleaseManifestError([
      `Ambiguous exact path classification: ${path}`,
    ]);
  }
  if (exact[0]) return exact[0];
  const subtrees = paths
    .filter(
      (entry) =>
        entry.match === "subtree" &&
        (path === entry.path || path.startsWith(`${entry.path}/`)),
    )
    .sort((left, right) => right.path.length - left.path.length);
  if (
    subtrees.length > 1 &&
    subtrees[0]?.path.length === subtrees[1]?.path.length
  ) {
    throw new CustomerReleaseManifestError([
      `Ambiguous subtree path classification: ${path}`,
    ]);
  }
  return subtrees[0];
}

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
      "materializationStatus",
      "fixtureReason",
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
  const rawMaterializationStatus = input.materializationStatus;
  let materializationStatus: "fixture-only" | "materializable" =
    "materializable";
  let fixtureReason = "";
  if (rawMaterializationStatus === "fixture-only") {
    materializationStatus = rawMaterializationStatus;
    fixtureReason = requiredString(
      input,
      "fixtureReason",
      "manifest",
      findings,
    );
  } else if (rawMaterializationStatus === "materializable") {
    materializationStatus = rawMaterializationStatus;
    if (input.fixtureReason !== undefined) {
      findings.push("materializable manifests must not declare fixtureReason");
    }
  } else {
    findings.push(
      "materializationStatus must be fixture-only or materializable",
    );
  }

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
  const classifications = new Set<string>();
  for (const entry of paths) {
    const key = `${entry.match}:${entry.path}`;
    if (classifications.has(key))
      findings.push(`Duplicate path classification: ${key}`);
    classifications.add(key);
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
    const classification = resolveCustomerReleasePath(paths, path);
    if (!classification) findings.push(`Unclassified shipped path: ${path}`);
    else if (classification.action !== "copy")
      findings.push(`Shipped path must use copy action: ${path}`);
    if (!sha256.test(actualHash))
      findings.push(`Invalid actual shipped hash: ${path}`);
    if (expectedHashes[path] !== actualHash)
      findings.push(`Hash mismatch for shipped path: ${path}`);
  }
  for (const entry of paths.filter(
    ({ action, match }) => action === "copy" && match === "exact",
  )) {
    if (!(entry.path in shippedFiles))
      findings.push(`Copied path missing from shipped release: ${entry.path}`);
    if (!(entry.path in expectedHashes))
      findings.push(`Copied path missing expected hash: ${entry.path}`);
  }
  for (const path of Object.keys(expectedHashes)) {
    if (resolveCustomerReleasePath(paths, path)?.action !== "copy")
      findings.push(`Expected hash must reference a copied path: ${path}`);
    if (!(path in shippedFiles))
      findings.push(
        `Expected copied path missing from shipped release: ${path}`,
      );
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
    if (
      resolveCustomerReleasePath(paths, path)?.ownership !==
      "customer-extension"
    ) {
      findings.push(
        `Extension seam must reference a customer-extension path: ${path}`,
      );
    }
    return [{ path, description }];
  });

  if (findings.length > 0) throw new CustomerReleaseManifestError(findings);
  const validated: CustomerReleaseManifestBase = {
    $schema: schemaPath,
    schemaVersion: 1,
    release: { version, tag, sourceCommit, sourceChecksum },
    compatibility: { cli, agentPack },
    paths,
    expectedHashes,
    extensionSeams,
  };
  return materializationStatus === "fixture-only"
    ? { ...validated, materializationStatus, fixtureReason }
    : { ...validated, materializationStatus };
}
