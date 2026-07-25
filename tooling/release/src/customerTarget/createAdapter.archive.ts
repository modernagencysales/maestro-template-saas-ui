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

export function withImmutableRelease<Result>(
  options: CustomerReleaseAdapterOptions,
  use: (resolved: ResolvedRelease) => Result,
): Result {
  const manifestBytes = readVerifiedManifest(options);
  const rawManifest = parseManifest(manifestBytes);
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
  const sourceCommit = resolveTagCommit(options.repositoryRoot, options.tag);
  if (sourceCommit !== preliminary.release.sourceCommit) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Resolved tag commit does not match the ownership manifest.",
    );
  }

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
    const manifest = validateCustomerReleaseManifest(rawManifest, shippedFiles);
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
