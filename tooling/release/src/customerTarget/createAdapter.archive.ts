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
  type CustomerReleaseManifest,
  type ResolvedCustomerReleaseBinding,
} from "./manifest.js";

export type ResolvedRelease = {
  readonly manifest: CustomerReleaseManifest;
  readonly binding: ResolvedCustomerReleaseBinding;
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
  if (!isRecord(value)) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Customer release manifest is invalid.",
    );
  }
  if (value.kind !== "composed-customer-release") {
    return { manifest: value, deriveExpectedHashes: false };
  }
  if (
    !isRecord(value.baseManifest) ||
    typeof value.baseManifest.path !== "string" ||
    typeof value.baseManifest.sha256 !== "string" ||
    !Array.isArray(value.additionalPaths) ||
    !isRecord(value.release) ||
    !isRecord(value.blueprintManifest) ||
    typeof value.blueprintManifest.path !== "string" ||
    value.blueprintManifest.sha256 !== options.blueprintManifestChecksum ||
    resolve(options.manifestPath, "..", value.blueprintManifest.path) !==
      resolve(options.blueprintManifestPath)
  ) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Composed customer release descriptor is invalid.",
    );
  }
  const basePath = resolve(options.manifestPath, "..", value.baseManifest.path);
  const baseBytes = readFileSync(basePath);
  if (sha256(baseBytes) !== value.baseManifest.sha256) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Base ownership manifest checksum is not reviewed.",
    );
  }
  const base = parseManifest(baseBytes);
  if (!isRecord(base)) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Base ownership manifest is invalid.",
    );
  }
  const paths = [
    ...(Array.isArray(base.paths) ? base.paths : []),
    ...value.additionalPaths,
  ];
  const expectedHashes = isRecord(base.expectedHashes)
    ? Object.fromEntries(
        Object.entries(base.expectedHashes).filter(
          ([path]) =>
            resolveCustomerReleasePath(paths, path)?.action === "copy",
        ),
      )
    : base.expectedHashes;
  return {
    deriveExpectedHashes: value.deriveExpectedHashesFromArchive === true,
    manifest: {
      ...base,
      materializationStatus: value.materializationStatus,
      fixtureReason: undefined,
      release: value.release,
      paths,
      expectedHashes,
    },
  };
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
      { stdio: ["ignore", "pipe", "ignore"] },
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
