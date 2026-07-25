import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  assertMaterializableCustomerReleaseManifest,
  resolveCustomerReleasePath,
  validateCustomerReleaseManifest,
  type CustomerReleaseManifest,
  type ResolvedCustomerReleaseBinding,
} from "./manifest.js";
import {
  materializeCustomerTarget,
  previewCustomerTarget,
  type CustomerMaterializationRequest,
  type CustomerTargetPreview,
} from "./materialize.js";

type CreateFailureCode =
  | "collision"
  | "dirty-source"
  | "release-unavailable"
  | "stale-preflight"
  | "unsafe-target";

type CreateFailure = {
  readonly ok: false;
  readonly code: CreateFailureCode;
  readonly message: string;
};

export type CustomerReleaseAdapterFacts = {
  readonly version: string;
  readonly tag: string;
  readonly sourceCommit: string;
  readonly sourceChecksum: string;
  readonly cliCompatibility: string;
  readonly agentPackCompatibility: string;
  readonly ownershipManifest: string;
  readonly ownershipManifestChecksum: string;
  readonly extensionSeams: readonly string[];
};

export type CustomerReleaseAdapterOptions = {
  readonly repositoryRoot: string;
  readonly manifestPath: string;
  readonly ownershipManifestChecksum: string;
  readonly tag: string;
  readonly homeRoot: string;
  readonly temporaryRoot?: string;
};

type PrepareRequest = {
  readonly repo: {
    readonly workingDirectory: string;
    readonly sourceRoot: string;
  };
  readonly target: string;
  readonly templateInstance: (facts: CustomerReleaseAdapterFacts) => string;
};

type PreparedRelease = {
  readonly ok: true;
  readonly token: object;
  readonly facts: CustomerReleaseAdapterFacts;
  readonly preview: {
    readonly preflightFingerprint: string;
    readonly writes: readonly {
      readonly path: string;
      readonly bytes: number;
    }[];
    readonly omissions: readonly string[];
    readonly collisions: readonly string[];
    readonly totalBytes: number;
  };
};

type TokenState = {
  readonly request: PrepareRequest;
  readonly templateInstance: string;
};

class CustomerReleaseAdapterError extends Error {
  readonly code: CreateFailureCode;

  constructor(code: CreateFailureCode, message: string) {
    super(message);
    this.name = "CustomerReleaseAdapterError";
    this.code = code;
  }
}

const sha256 = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export function createCustomerReleaseAdapter(
  options: CustomerReleaseAdapterOptions,
) {
  const tokens = new WeakMap<object, TokenState>();
  return {
    prepare: async (
      request: PrepareRequest,
    ): Promise<PreparedRelease | CreateFailure> => {
      try {
        return withImmutableRelease(options, request, undefined, (resolved) => {
          const templateInstance = request.templateInstance(resolved.facts);
          const generatedFiles = generatedEntries(
            resolved.manifest,
            resolved.sourceRoot,
            templateInstance,
          );
          const materialization = materializationRequest(
            options,
            request,
            resolved,
            generatedFiles,
          );
          const preview = previewCustomerTarget(materialization);
          const token = {};
          tokens.set(token, { request, templateInstance });
          return {
            ok: true as const,
            token,
            facts: resolved.facts,
            preview: projectPreview(preview),
          };
        });
      } catch (error) {
        return failure(error);
      }
    },
    materialize: async (
      token: unknown,
      preflightFingerprint: string,
    ): Promise<
      { readonly ok: true; readonly files: number } | CreateFailure
    > => {
      if (!isObject(token)) {
        return {
          ok: false,
          code: "stale-preflight",
          message: "Create release token is invalid or already consumed.",
        };
      }
      const state = tokens.get(token);
      tokens.delete(token);
      if (!state) {
        return {
          ok: false,
          code: "stale-preflight",
          message: "Create release token is invalid or already consumed.",
        };
      }
      try {
        return withImmutableRelease(
          options,
          state.request,
          state.templateInstance,
          (resolved) => {
            const generatedFiles = generatedEntries(
              resolved.manifest,
              resolved.sourceRoot,
              state.templateInstance,
            );
            const request = materializationRequest(
              options,
              state.request,
              resolved,
              generatedFiles,
            );
            const preview = previewCustomerTarget(request);
            if (preview.preflightFingerprint !== preflightFingerprint) {
              throw new CustomerReleaseAdapterError(
                "stale-preflight",
                "Customer release preflight changed after preview.",
              );
            }
            const result = materializeCustomerTarget(request, preview);
            return { ok: true as const, files: result.files };
          },
        );
      } catch (error) {
        return failure(error);
      }
    },
  };
}

type ResolvedRelease = {
  readonly manifest: CustomerReleaseManifest;
  readonly binding: ResolvedCustomerReleaseBinding;
  readonly facts: CustomerReleaseAdapterFacts;
  readonly sourceRoot: string;
};

function withImmutableRelease<Result>(
  options: CustomerReleaseAdapterOptions,
  request: PrepareRequest,
  _templateInstance: string | undefined,
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
    const binding = {
      tag: options.tag,
      sourceCommit,
      sourceChecksum,
    };
    assertMaterializableCustomerReleaseManifest(manifest, binding);
    const facts = releaseFacts(options, manifest);
    return use({ manifest, binding, facts, sourceRoot });
  } finally {
    rmSync(sessionRoot, { recursive: true, force: true });
  }
}

function readVerifiedManifest(options: CustomerReleaseAdapterOptions): Buffer {
  const bytes = readFileSync(options.manifestPath);
  if (sha256(bytes) !== options.ownershipManifestChecksum) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Ownership manifest checksum does not match the reviewed release binding.",
    );
  }
  return bytes;
}

function parseManifest(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Ownership manifest is not valid JSON.",
    );
  }
}

function rawExpectedHashes(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value) || !isRecord(value.expectedHashes)) return {};
  return Object.fromEntries(
    Object.entries(value.expectedHashes).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
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
    const fullPath = safeSourceFile(sourceRoot, path);
    shipped[path] = sha256(readFileSync(fullPath));
  }
  return shipped;
}

function generatedEntries(
  manifest: CustomerReleaseManifest,
  sourceRoot: string,
  templateInstance: string,
): Readonly<Record<string, Buffer>> {
  return Object.fromEntries(
    manifest.paths
      .filter(({ action, match }) => action === "generate" && match === "exact")
      .map(({ path }) => [
        path,
        path === "template-instance.json"
          ? Buffer.from(templateInstance)
          : readFileSync(safeSourceFile(sourceRoot, path)),
      ]),
  );
}

function materializationRequest(
  options: CustomerReleaseAdapterOptions,
  request: PrepareRequest,
  resolvedRelease: ResolvedRelease,
  generatedFiles: Readonly<Record<string, Buffer>>,
): CustomerMaterializationRequest {
  return {
    manifest: resolvedRelease.manifest,
    sourceRoot: resolvedRelease.sourceRoot,
    targetRoot: isAbsolute(request.target)
      ? resolve(request.target)
      : resolve(request.repo.workingDirectory, request.target),
    homeRoot: options.homeRoot,
    factoryRoot: request.repo.sourceRoot,
    sourceDirty: false,
    sourceRevision: resolvedRelease.binding.sourceCommit,
    generatedFiles,
    resolvedRelease: resolvedRelease.binding,
  };
}

function releaseFacts(
  options: CustomerReleaseAdapterOptions,
  manifest: CustomerReleaseManifest,
): CustomerReleaseAdapterFacts {
  const manifestPath = relative(options.repositoryRoot, options.manifestPath);
  return {
    version: manifest.release.version,
    tag: manifest.release.tag,
    sourceCommit: manifest.release.sourceCommit,
    sourceChecksum: manifest.release.sourceChecksum,
    cliCompatibility: manifest.compatibility.cli,
    agentPackCompatibility: manifest.compatibility.agentPack,
    ownershipManifest:
      manifestPath === "" ||
      manifestPath === ".." ||
      manifestPath.startsWith(`..${sep}`)
        ? options.manifestPath
        : manifestPath.split(sep).join("/"),
    ownershipManifestChecksum: options.ownershipManifestChecksum,
    extensionSeams: manifest.extensionSeams.map(({ path }) => path),
  };
}

function projectPreview(
  preview: CustomerTargetPreview,
): PreparedRelease["preview"] {
  return {
    preflightFingerprint: preview.preflightFingerprint,
    writes: preview.writes.map(({ path, bytes }) => ({ path, bytes })),
    omissions: preview.omissions,
    collisions: preview.collisions,
    totalBytes: preview.totalBytes,
  };
}

function listFiles(root: string, prefix = ""): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? listFiles(join(root, entry.name), path)
      : [path];
  });
}

function safeSourceFile(root: string, path: string): string {
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

function failure(error: unknown): CreateFailure {
  if (error instanceof CustomerReleaseAdapterError) {
    return { ok: false, code: error.code, message: error.message };
  }
  const message = error instanceof Error ? error.message : "unknown failure";
  if (/collision|non-empty|Target contains/i.test(message)) {
    return { ok: false, code: "collision", message };
  }
  if (/target|root|symbolic|path escape/i.test(message)) {
    return { ok: false, code: "unsafe-target", message };
  }
  if (/preflight|hash mismatch|changed/i.test(message)) {
    return { ok: false, code: "stale-preflight", message };
  }
  return {
    ok: false,
    code: "release-unavailable",
    message: "Immutable customer release verification failed.",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}
