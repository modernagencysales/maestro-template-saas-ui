import { execFileSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import {
  CustomerReleaseAdapterError,
  parseManifest,
  isRecord,
  rawExpectedHashes,
  readVerifiedManifest,
  releaseFacts,
  sha256,
  type CustomerReleaseAdapterFacts,
  type CustomerReleaseAdapterOptions,
} from "./createAdapter.contract.js";
import {
  assertMaterializableCustomerReleaseManifest,
  resolveCustomerReleasePath,
  validateCustomerReleaseManifest,
  type CustomerReleasePath,
  type CustomerReleaseManifest,
  type ResolvedCustomerReleaseBinding,
} from "./manifest.js";

export type ResolvedRelease = {
  readonly manifest: CustomerReleaseManifest;
  readonly binding: ResolvedCustomerReleaseBinding;
  readonly tagCommit: string;
  readonly facts: CustomerReleaseAdapterFacts;
  readonly sourceRoot: string;
};

const safeRelativePath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith("/") &&
  !path.includes("\\") &&
  path
    .split("/")
    .every((part) => part.length > 0 && part !== "." && part !== "..");

export function withImmutableRelease<Result>(
  options: CustomerReleaseAdapterOptions,
  use: (resolved: ResolvedRelease) => Result,
): Result {
  const manifestBytes = readVerifiedManifest(options);
  const definition = resolveReleaseDefinition(
    options,
    parseManifest(manifestBytes),
  );
  const rawManifest = definition.manifest;
  const preliminary = validateCustomerReleaseManifest(
    rawManifest,
    rawExpectedHashes(rawManifest),
  );
  if (preliminary.materializationStatus === "fixture-only") {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      `Release manifest is fixture-only: ${preliminary.fixtureReason}`,
    );
  }
  if (preliminary.release.tag !== options.tag) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Requested tag does not match the ownership manifest.",
    );
  }
  const tagCommit = resolveTagCommit(options.repositoryRoot, options.tag);
  const sourceCommit = resolveReviewedCommit(
    options.repositoryRoot,
    options.sourceCommit ?? preliminary.release.sourceCommit,
  );
  if (sourceCommit !== preliminary.release.sourceCommit) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Resolved source commit does not match the ownership manifest.",
    );
  }
  assertSourceAncestorOfTag(options.repositoryRoot, sourceCommit, tagCommit);
  const manifestRelative = relative(
    realpathSync(options.repositoryRoot),
    realpathSync(options.manifestPath),
  )
    .split(sep)
    .join("/");
  if (!safeRelativePath(manifestRelative))
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Ownership manifest escapes the trusted repository.",
    );
  assertTaggedManifest(
    options.repositoryRoot,
    tagCommit,
    manifestRelative,
    manifestBytes,
  );

  const temporaryRoot = options.temporaryRoot ?? tmpdir();
  const sessionRoot = mkdtempSync(
    join(realpathSync(temporaryRoot), "maestro-release-"),
  );
  try {
    const archivePath = join(sessionRoot, "source.tar");
    createArchive(options.repositoryRoot, sourceCommit, archivePath);
    const sourceChecksum = sha256(readFileSync(archivePath));
    if (sourceChecksum !== preliminary.release.sourceChecksum) {
      throw new CustomerReleaseAdapterError(
        "release-unavailable",
        "Resolved release archive checksum does not match the ownership manifest.",
      );
    }
    const sourceRoot = join(sessionRoot, "source");
    mkdirSync(sourceRoot);
    extractArchive(archivePath, sourceRoot);
    const shippedFiles = copiedFileHashes(preliminary, sourceRoot);
    const manifest = validateCustomerReleaseManifest(
      definition.deriveExpectedHashes
        ? { ...rawManifest, expectedHashes: shippedFiles }
        : rawManifest,
      shippedFiles,
    );
    const binding = { tag: options.tag, sourceCommit, sourceChecksum };
    assertMaterializableCustomerReleaseManifest(manifest, binding);
    return use({
      manifest,
      binding,
      tagCommit,
      facts: releaseFacts(options, manifest),
      sourceRoot,
    });
  } finally {
    rmSync(sessionRoot, { recursive: true, force: true });
  }
}

function resolveReleaseDefinition(
  options: CustomerReleaseAdapterOptions,
  value: unknown,
): {
  readonly manifest: Record<string, unknown>;
  readonly deriveExpectedHashes: boolean;
} {
  return resolveReleaseDefinitionAt({
    options,
    manifestPath: options.manifestPath,
    value,
    requireBlueprintBinding: true,
    visited: new Set<string>(),
  });
}

// eslint-disable-next-line complexity -- AP-008 tracks splitting this pre-existing release resolver; authority replacement changes adjacent composition only.
function resolveReleaseDefinitionAt(input: {
  readonly options: CustomerReleaseAdapterOptions;
  readonly manifestPath: string;
  readonly value: unknown;
  readonly requireBlueprintBinding: boolean;
  readonly visited: Set<string>;
}): {
  readonly manifest: Record<string, unknown>;
  readonly deriveExpectedHashes: boolean;
} {
  const { options, manifestPath, value, requireBlueprintBinding, visited } =
    input;
  if (!isRecord(value)) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Customer release manifest is invalid.",
    );
  }
  if (value.kind !== "composed-customer-release") {
    return { manifest: value, deriveExpectedHashes: false };
  }
  const blueprintBindingInvalid =
    requireBlueprintBinding &&
    (!isRecord(value.blueprintManifest) ||
      typeof value.blueprintManifest.path !== "string" ||
      value.blueprintManifest.sha256 !== options.blueprintManifestChecksum ||
      resolve(manifestPath, "..", value.blueprintManifest.path) !==
        resolve(options.blueprintManifestPath));
  if (
    !isRecord(value.baseManifest) ||
    typeof value.baseManifest.path !== "string" ||
    typeof value.baseManifest.sha256 !== "string" ||
    !Array.isArray(value.additionalPaths) ||
    !isRecord(value.release) ||
    blueprintBindingInvalid
  ) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Composed customer release descriptor is invalid.",
    );
  }
  const basePath = resolve(manifestPath, "..", value.baseManifest.path);
  const canonicalBasePath = realpathSync(basePath);
  if (visited.has(canonicalBasePath)) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Composed customer release contains a manifest cycle.",
    );
  }
  visited.add(canonicalBasePath);
  const baseBytes = readFileSync(basePath);
  if (sha256(baseBytes) !== value.baseManifest.sha256) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Base ownership manifest checksum is not reviewed.",
    );
  }
  const base = resolveReleaseDefinitionAt({
    options,
    manifestPath: basePath,
    value: parseManifest(baseBytes),
    requireBlueprintBinding: false,
    visited,
  });
  const operations =
    isRecord(value.upgrade) && Array.isArray(value.upgrade.operations)
      ? value.upgrade.operations
      : [];
  const paths = composedReleasePaths(
    (Array.isArray(base.manifest.paths)
      ? base.manifest.paths
      : []) as CustomerReleasePath[],
    value.additionalPaths as CustomerReleasePath[],
    operations,
  );
  const expectedHashes = composedExpectedHashes(
    base.manifest.expectedHashes,
    paths,
    operations,
  );
  return {
    deriveExpectedHashes:
      value.deriveExpectedHashesFromArchive === true ||
      base.deriveExpectedHashes,
    manifest: {
      ...base.manifest,
      materializationStatus: value.materializationStatus,
      fixtureReason: undefined,
      release: value.release,
      paths,
      expectedHashes,
    },
  };
}

export function composedReleasePaths(
  base: readonly CustomerReleasePath[],
  additional: readonly CustomerReleasePath[],
  operations: readonly unknown[],
): readonly CustomerReleasePath[] {
  const replacements = new Set(
    additional.map((entry) => `${entry.match}:${entry.path}`),
  );
  const deleted = new Set(
    operations.flatMap((operation) =>
      isRecord(operation) &&
      operation.kind === "delete" &&
      typeof operation.path === "string"
        ? [operation.path]
        : [],
    ),
  );
  return [
    ...base.filter(
      (entry) => !replacements.has(`${entry.match}:${entry.path}`),
    ),
    ...additional,
  ]
    .filter((entry) => entry.match !== "exact" || !deleted.has(entry.path))
    .concat(
      [...deleted].map((path) => ({
        path,
        match: "exact" as const,
        ownership: "factory-only" as const,
        action: "omit" as const,
        upgrade: "remove" as const,
      })),
    );
}

// eslint-disable-next-line complexity -- AP-008 tracks splitting this pre-existing hash composer; authority replacement changes adjacent path composition only.
export function composedExpectedHashes(
  baseExpectedHashes: unknown,
  paths: readonly CustomerReleasePath[],
  operations: readonly unknown[],
): Readonly<Record<string, unknown>> {
  const expected = isRecord(baseExpectedHashes)
    ? Object.fromEntries(
        Object.entries(baseExpectedHashes).filter(
          ([path]) =>
            resolveCustomerReleasePath(paths, path)?.action === "copy",
        ),
      )
    : {};
  for (const operation of operations) {
    if (!isRecord(operation) || typeof operation.path !== "string") continue;
    if (resolveCustomerReleasePath(paths, operation.path)?.action !== "copy")
      continue;
    if (operation.kind === "delete") {
      delete expected[operation.path];
    } else if (
      (operation.kind === "add" || operation.kind === "modify") &&
      typeof operation.afterHash === "string"
    ) {
      expected[operation.path] = operation.afterHash;
    }
  }
  return expected;
}

function resolveReviewedCommit(repositoryRoot: string, commit: string): string {
  try {
    return execFileSync(
      "git",
      [
        "-C",
        realpathSync(repositoryRoot),
        "rev-parse",
        "--verify",
        `${commit}^{commit}`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Reviewed immutable release commit is not available.",
    );
  }
}

function resolveTagCommit(repositoryRoot: string, tag: string): string {
  try {
    return execFileSync(
      "git",
      [
        "-C",
        realpathSync(repositoryRoot),
        "rev-parse",
        "--verify",
        `refs/tags/${tag}^{commit}`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Immutable release tag is not available in the repository.",
    );
  }
}
function assertSourceAncestorOfTag(
  repositoryRoot: string,
  sourceCommit: string,
  tagCommit: string,
): void {
  try {
    execFileSync(
      "git",
      [
        "-C",
        realpathSync(repositoryRoot),
        "merge-base",
        "--is-ancestor",
        sourceCommit,
        tagCommit,
      ],
      { stdio: ["ignore", "ignore", "ignore"] },
    );
  } catch {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Reviewed source commit is not an ancestor of the immutable release tag.",
    );
  }
}
function assertTaggedManifest(
  repositoryRoot: string,
  tagCommit: string,
  manifestPath: string,
  expected: Buffer,
): void {
  let tagged: Buffer;
  try {
    tagged = execFileSync(
      "git",
      [
        "-C",
        realpathSync(repositoryRoot),
        "show",
        `${tagCommit}:${manifestPath}`,
      ],
      {
        maxBuffer: expected.length + 1024,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Immutable release tag does not contain the ownership manifest.",
    );
  }
  if (!tagged.equals(expected))
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Tagged ownership manifest bytes do not match the compiled authority.",
    );
}

function createArchive(
  repositoryRoot: string,
  sourceCommit: string,
  archivePath: string,
): void {
  try {
    execFileSync(
      "git",
      [
        "-C",
        realpathSync(repositoryRoot),
        "archive",
        "--format=tar",
        `--output=${archivePath}`,
        sourceCommit,
      ],
      { stdio: ["ignore", "ignore", "ignore"] },
    );
  } catch {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Immutable release archive could not be produced.",
    );
  }
}

function extractArchive(archivePath: string, sourceRoot: string): void {
  try {
    execFileSync("tar", ["-xf", archivePath, "-C", sourceRoot], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Immutable release archive could not be extracted.",
    );
  }
}

function copiedFileHashes(
  manifest: CustomerReleaseManifest,
  sourceRoot: string,
): Readonly<Record<string, string>> {
  const shipped: Record<string, string> = {};
  for (const path of listFiles(sourceRoot)) {
    const entry = resolveCustomerReleasePath(manifest.paths, path);
    if (!entry) {
      throw new CustomerReleaseAdapterError(
        "release-unavailable",
        `Immutable release contains an unclassified path: ${path}`,
      );
    }
    if (entry.action !== "copy") continue;
    shipped[path] = sha256(readFileSync(safeSourceFile(sourceRoot, path)));
  }
  return shipped;
}

function listFiles(root: string, prefix = ""): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? listFiles(join(root, entry.name), path)
      : [path];
  });
}

export function safeSourceFile(root: string, path: string): string {
  const fullPath = resolve(root, path);
  const relativePath = relative(root, fullPath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    lstatSync(fullPath).isSymbolicLink() ||
    !lstatSync(fullPath).isFile()
  ) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      `Immutable release path is not a regular contained file: ${path}`,
    );
  }
  return fullPath;
}
