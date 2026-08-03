#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildResolvedSourceClosure,
  checksumSourceClosure,
  normalizedSourcePath,
  type SourceClosure,
} from "../generators/src/workflow-source-closure";

export {
  buildResolvedSourceClosure,
  checksumSourceClosure,
} from "../generators/src/workflow-source-closure";
export type { SourceClosure } from "../generators/src/workflow-source-closure";

export type PublicationArtifactClass =
  | "graph"
  | "runner"
  | "event"
  | "completion"
  | "capability"
  | "dependency"
  | "interpreter"
  | "registry";

export type PublicationEntry = {
  readonly kind: "workflow" | "capability";
  readonly logicalId: string;
  readonly version: number;
  readonly lifecycle: "draft" | "published" | "retired";
  readonly isolatedFixture: boolean;
  readonly fingerprint: Readonly<Record<string, string>>;
  readonly sourceClosure: SourceClosure;
  readonly artifacts: readonly {
    readonly class: PublicationArtifactClass;
    readonly path: string;
    readonly checksum: string;
  }[];
};

export type UnsignedWorkflowPublicationManifest = {
  readonly schemaVersion: 1;
  readonly entries: readonly PublicationEntry[];
};

export type WorkflowPublicationManifest =
  UnsignedWorkflowPublicationManifest & {
    readonly manifestChecksum: string;
  };

const canonicalManifestPath =
  "docs/template/generated/workflow-publications.json";
const sha256Pattern = /^[a-f0-9]{64}$/;

const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const canonicalJson = (value: unknown): string =>
  JSON.stringify(canonicalize(value));

export const checksumPublicationManifest = (
  manifest: UnsignedWorkflowPublicationManifest,
): string => sha256(canonicalJson(manifest));

export const verifyPublicationManifestChecksum = (
  manifest: WorkflowPublicationManifest,
): readonly string[] => {
  const { manifestChecksum, ...unsigned } = manifest;
  const findings: string[] = [];
  if (manifestChecksum !== checksumPublicationManifest(unsigned)) {
    findings.push("publication manifest checksum mismatch");
  }
  for (const entry of manifest.entries) {
    if (
      entry.sourceClosure.checksum !==
      checksumSourceClosure(entry.sourceClosure)
    ) {
      findings.push(
        `publication source closure checksum mismatch: ${entry.logicalId}@v${entry.version}`,
      );
    }
    if (entry.lifecycle !== "draft" && !entry.isolatedFixture) {
      findings.push(
        `Phase 1 publication must remain an isolated fixture: ${entry.logicalId}@v${entry.version}`,
      );
    }
    for (const artifact of entry.artifacts) {
      if (!sha256Pattern.test(artifact.checksum)) {
        findings.push(`invalid artifact checksum: ${artifact.path}`);
      }
    }
  }
  return findings;
};

const entryKey = (entry: PublicationEntry): string =>
  `${entry.kind}:${entry.logicalId}@v${entry.version}`;

const immutableEntry = (entry: PublicationEntry): unknown => ({
  ...entry,
  lifecycle: entry.lifecycle === "retired" ? "published" : entry.lifecycle,
});

export const compareTrustedPublications = (
  trusted: WorkflowPublicationManifest,
  current: WorkflowPublicationManifest,
): readonly string[] => {
  const findings: string[] = [];
  for (const trustedEntry of trusted.entries) {
    if (trustedEntry.lifecycle === "draft") continue;
    const currentEntry = current.entries.find(
      (candidate) => entryKey(candidate) === entryKey(trustedEntry),
    );
    if (!currentEntry) {
      findings.push(
        `published ${trustedEntry.kind} ${trustedEntry.logicalId}@v${trustedEntry.version} deleted or moved`,
      );
      continue;
    }
    if (
      canonicalJson(immutableEntry(currentEntry)) !==
      canonicalJson(immutableEntry(trustedEntry))
    ) {
      findings.push(
        `published ${trustedEntry.kind} ${trustedEntry.logicalId}@v${trustedEntry.version} changed`,
      );
    }
  }
  return findings;
};

export const findWorkingTreePublicationDrift = (
  repoRoot: string,
  manifest: WorkflowPublicationManifest,
): readonly string[] => {
  const findings: string[] = [];
  for (const entry of manifest.entries) {
    if (entry.lifecycle === "draft") continue;
    try {
      const actualClosure = buildResolvedSourceClosure(
        repoRoot,
        entry.sourceClosure.roots,
      );
      if (canonicalJson(actualClosure) !== canonicalJson(entry.sourceClosure)) {
        findings.push(
          `source closure drift: ${entry.logicalId}@v${entry.version}`,
        );
      }
    } catch (error) {
      findings.push(
        `source closure resolution failed: ${entry.logicalId}@v${entry.version}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    for (const artifact of entry.artifacts) {
      const absolutePath = resolve(repoRoot, artifact.path);
      try {
        normalizedSourcePath(resolve(repoRoot), absolutePath);
      } catch {
        findings.push(
          `${artifact.class} artifact escaped repository: ${artifact.path}`,
        );
        continue;
      }
      if (!existsSync(absolutePath)) {
        findings.push(`${artifact.class} artifact missing: ${artifact.path}`);
        continue;
      }
      const checksum = sha256(readFileSync(absolutePath));
      if (checksum !== artifact.checksum) {
        findings.push(`${artifact.class} artifact drift: ${artifact.path}`);
      }
    }
  }
  return findings;
};

export const validateComparisonBase = (
  callerBase: string,
  actualMergeBase: string,
): void => {
  if (callerBase !== actualMergeBase) {
    throw new Error(
      `Caller comparison base ${callerBase} is not the actual merge base ${actualMergeBase}`,
    );
  }
};

const repoRootFromScript = (): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const git = (repoRoot: string, args: readonly string[]): string =>
  execFileSync("git", [...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

type GitReader = (args: readonly string[]) => string;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void => {
  const expected = new Set(keys);
  const unexpected = Object.keys(value).filter((key) => !expected.has(key));
  if (unexpected.length > 0) {
    throw new Error(
      `${label} contains unknown fields: ${unexpected.join(", ")}`,
    );
  }
};

const parseEntry = (value: unknown): PublicationEntry => {
  if (!isRecord(value)) throw new Error("publication entry must be an object");
  assertExactKeys(
    value,
    [
      "kind",
      "logicalId",
      "version",
      "lifecycle",
      "isolatedFixture",
      "fingerprint",
      "sourceClosure",
      "artifacts",
    ],
    "publication entry",
  );
  if (value.kind !== "workflow" && value.kind !== "capability") {
    throw new Error("publication entry kind is invalid");
  }
  if (typeof value.logicalId !== "string" || value.logicalId.length === 0) {
    throw new Error("publication entry logicalId is invalid");
  }
  if (!Number.isSafeInteger(value.version) || Number(value.version) < 1) {
    throw new Error("publication entry version is invalid");
  }
  if (
    value.lifecycle !== "draft" &&
    value.lifecycle !== "published" &&
    value.lifecycle !== "retired"
  ) {
    throw new Error("publication entry lifecycle is invalid");
  }
  if (typeof value.isolatedFixture !== "boolean") {
    throw new Error("publication entry fixture posture is invalid");
  }
  if (!isRecord(value.fingerprint)) {
    throw new Error("publication fingerprint is invalid");
  }
  const fingerprint = Object.fromEntries(
    Object.entries(value.fingerprint).map(([key, field]) => {
      if (typeof field !== "string") {
        throw new Error(`publication fingerprint ${key} is invalid`);
      }
      return [key, field];
    }),
  );
  if (!isRecord(value.sourceClosure)) {
    throw new Error("publication source closure is invalid");
  }
  assertExactKeys(
    value.sourceClosure,
    ["roots", "modules", "checksum"],
    "publication source closure",
  );
  if (
    !Array.isArray(value.sourceClosure.roots) ||
    !value.sourceClosure.roots.every((root) => typeof root === "string") ||
    !Array.isArray(value.sourceClosure.modules) ||
    typeof value.sourceClosure.checksum !== "string"
  ) {
    throw new Error("publication source closure fields are invalid");
  }
  const sourceClosure: SourceClosure = {
    roots: value.sourceClosure.roots,
    modules: value.sourceClosure.modules.map((module) => {
      if (
        !isRecord(module) ||
        typeof module.path !== "string" ||
        typeof module.checksum !== "string"
      ) {
        throw new Error("publication source module is invalid");
      }
      assertExactKeys(
        module,
        ["path", "checksum"],
        "publication source module",
      );
      return { path: module.path, checksum: module.checksum };
    }),
    checksum: value.sourceClosure.checksum,
  };
  if (!Array.isArray(value.artifacts)) {
    throw new Error("publication artifacts are invalid");
  }
  const artifacts = value.artifacts.map((artifact) => {
    if (!isRecord(artifact)) throw new Error("publication artifact is invalid");
    assertExactKeys(
      artifact,
      ["class", "path", "checksum"],
      "publication artifact",
    );
    const allowedClasses: readonly PublicationArtifactClass[] = [
      "graph",
      "runner",
      "event",
      "completion",
      "capability",
      "dependency",
      "interpreter",
      "registry",
    ];
    if (
      typeof artifact.class !== "string" ||
      !allowedClasses.includes(artifact.class as PublicationArtifactClass) ||
      typeof artifact.path !== "string" ||
      typeof artifact.checksum !== "string"
    ) {
      throw new Error("publication artifact fields are invalid");
    }
    return {
      class: artifact.class as PublicationArtifactClass,
      path: artifact.path,
      checksum: artifact.checksum,
    };
  });
  return {
    kind: value.kind,
    logicalId: value.logicalId,
    version: Number(value.version),
    lifecycle: value.lifecycle,
    isolatedFixture: value.isolatedFixture,
    fingerprint,
    sourceClosure,
    artifacts,
  };
};

export const parsePublicationManifest = (
  source: string,
): WorkflowPublicationManifest => {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value))
    throw new Error("publication manifest must be an object");
  assertExactKeys(
    value,
    ["schemaVersion", "entries", "manifestChecksum"],
    "publication manifest",
  );
  if (value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
    throw new Error("publication manifest schema is invalid");
  }
  if (typeof value.manifestChecksum !== "string") {
    throw new Error("publication manifest checksum is invalid");
  }
  return {
    schemaVersion: 1,
    entries: value.entries.map(parseEntry),
    manifestChecksum: value.manifestChecksum,
  };
};

const safeBranch = (branch: string): boolean =>
  /^[A-Za-z0-9._/-]+$/.test(branch) &&
  !branch.startsWith("-") &&
  !branch.includes("..") &&
  !branch.includes("//") &&
  !branch.endsWith("/") &&
  !branch.endsWith(".lock");

export const deriveActualPublicationMergeBase = (
  readGit: GitReader,
  environment: Readonly<Record<string, string | undefined>>,
): string => {
  const branch = environment.CI_COMMIT_TARGET_BRANCH?.trim() || "main";
  if (!safeBranch(branch)) {
    throw new Error(`Invalid canonical CI comparison branch: ${branch}`);
  }
  const candidates = [`refs/remotes/origin/${branch}`, `refs/heads/${branch}`];
  let trustedRef: string | undefined;
  for (const candidate of candidates) {
    try {
      const resolved = readGit([
        "rev-parse",
        "--verify",
        "--end-of-options",
        `${candidate}^{commit}`,
      ]);
      if (resolved.length > 0) {
        trustedRef = candidate;
        break;
      }
    } catch {
      // Try the same CI-owned branch in the other canonical namespace.
    }
  }
  if (!trustedRef) {
    throw new Error(`Canonical CI comparison ref does not exist: ${branch}`);
  }
  const mergeBase = readGit(["merge-base", "HEAD", trustedRef]);
  if (!/^[a-f0-9]{40,64}$/.test(mergeBase)) {
    throw new Error("Git did not return a valid actual merge base");
  }
  return mergeBase;
};

export const readTrustedPublicationManifest = (
  readGit: GitReader,
  actualMergeBase: string,
  allowFirstPublication: boolean,
): WorkflowPublicationManifest | null => {
  const listing = readGit([
    "ls-tree",
    "--name-only",
    actualMergeBase,
    "--",
    canonicalManifestPath,
  ]);
  if (listing === "") {
    if (!allowFirstPublication) {
      throw new Error(
        "Trusted base has no publication manifest; pass --allow-first-publication only to establish the first baseline",
      );
    }
    return null;
  }
  if (listing !== canonicalManifestPath) {
    throw new Error("Trusted base manifest lookup returned an unexpected path");
  }
  const source = readGit([
    "show",
    `${actualMergeBase}:${canonicalManifestPath}`,
  ]);
  const manifest = parsePublicationManifest(source);
  const findings = verifyPublicationManifestChecksum(manifest);
  if (findings.length > 0) {
    throw new Error(
      `Trusted publication manifest is invalid: ${findings.join(", ")}`,
    );
  }
  return manifest;
};

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

export const runWorkflowVersionImmutabilityCheck = (
  repoRoot = repoRootFromScript(),
): readonly string[] => {
  const callerBase = argument("--comparison-base");
  const allowFirstPublication = process.argv.includes(
    "--allow-first-publication",
  );
  const requestedManifest =
    argument("--publication-manifest") ?? canonicalManifestPath;
  if (!callerBase) throw new Error("Missing --comparison-base");
  if (requestedManifest !== canonicalManifestPath) {
    throw new Error(`Publication manifest must be ${canonicalManifestPath}`);
  }
  const current = parsePublicationManifest(
    readFileSync(resolve(repoRoot, canonicalManifestPath), "utf8"),
  );
  const readGit: GitReader = (args) => git(repoRoot, args);
  const actualMergeBase = deriveActualPublicationMergeBase(
    readGit,
    process.env,
  );
  validateComparisonBase(callerBase, actualMergeBase);
  const findings = [
    ...verifyPublicationManifestChecksum(current),
    ...findWorkingTreePublicationDrift(repoRoot, current),
  ];
  const trusted = readTrustedPublicationManifest(
    readGit,
    actualMergeBase,
    allowFirstPublication,
  );
  if (trusted) {
    findings.push(...compareTrustedPublications(trusted, current));
  }
  return findings;
};

if (process.argv[1]?.endsWith("check-workflow-version-immutability.mts")) {
  const findings = runWorkflowVersionImmutabilityCheck();
  if (findings.length > 0) {
    process.stderr.write(`${findings.join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("check:workflow-version-immutability passed\n");
  }
}
