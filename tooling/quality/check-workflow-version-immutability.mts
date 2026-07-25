#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

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
  readonly artifacts: readonly {
    readonly class: PublicationArtifactClass;
    readonly path: string;
    readonly checksum: string;
  }[];
};

export type UnsignedWorkflowPublicationManifest = {
  readonly schemaVersion: 1;
  readonly trustedComparisonRef: "main";
  readonly entries: readonly PublicationEntry[];
};

export type WorkflowPublicationManifest =
  UnsignedWorkflowPublicationManifest & {
    readonly manifestChecksum: string;
  };

export type SourceClosure = {
  readonly roots: readonly string[];
  readonly modules: readonly {
    readonly path: string;
    readonly checksum: string;
  }[];
  readonly checksum: string;
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
  if (manifest.trustedComparisonRef !== "main") {
    findings.push("publication manifest must use trusted comparison ref main");
  }
  for (const entry of manifest.entries) {
    if (
      entry.lifecycle !== "draft" &&
      (!entry.isolatedFixture ||
        (entry.kind === "workflow" && !entry.logicalId.includes("fixture")))
    ) {
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

const normalizedRelativePath = (root: string, absolutePath: string): string => {
  const path = relative(root, absolutePath).split(sep).join("/");
  if (path === ".." || path.startsWith("../")) {
    throw new Error(`Source closure escaped repository root: ${absolutePath}`);
  }
  return path;
};

const importSpecifiers = (source: string): readonly string[] => {
  const specifiers: string[] = [];
  const pattern =
    /(?:import|export)\s+(?:[^"']*?\sfrom\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier?.startsWith(".")) specifiers.push(specifier);
  }
  return specifiers;
};

const resolveImport = (fromPath: string, specifier: string): string => {
  const base = resolve(dirname(fromPath), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.js`,
    resolve(base, "index.ts"),
    resolve(base, "index.tsx"),
    resolve(base, "index.mts"),
  ];
  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  if (!resolvedPath) {
    throw new Error(`Unresolved import ${specifier} from ${fromPath}`);
  }
  return resolvedPath;
};

export const buildResolvedSourceClosure = (
  repoRoot: string,
  roots: readonly string[],
): SourceClosure => {
  const absoluteRoot = resolve(repoRoot);
  const pending = roots.map((root) => resolve(absoluteRoot, root));
  const sources = new Map<string, string>();
  while (pending.length > 0) {
    const absolutePath = pending.pop();
    if (!absolutePath || sources.has(absolutePath)) continue;
    if (!existsSync(absolutePath)) {
      throw new Error(`Source closure root is missing: ${absolutePath}`);
    }
    normalizedRelativePath(absoluteRoot, absolutePath);
    const source = readFileSync(absolutePath, "utf8");
    sources.set(absolutePath, source);
    for (const specifier of importSpecifiers(source)) {
      pending.push(resolveImport(absolutePath, specifier));
    }
  }
  const modules = [...sources]
    .map(([path, source]) => ({
      path: normalizedRelativePath(absoluteRoot, path),
      checksum: sha256(source),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const normalizedRoots = roots.map((root) =>
    normalizedRelativePath(absoluteRoot, resolve(absoluteRoot, root)),
  );
  return {
    roots: normalizedRoots,
    modules,
    checksum: sha256(canonicalJson({ roots: normalizedRoots, modules })),
  };
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
    for (const artifact of entry.artifacts) {
      const absolutePath = resolve(repoRoot, artifact.path);
      try {
        normalizedRelativePath(resolve(repoRoot), absolutePath);
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

const parseManifest = (source: string): WorkflowPublicationManifest =>
  JSON.parse(source) as WorkflowPublicationManifest;

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

export const runWorkflowVersionImmutabilityCheck = (
  repoRoot = repoRootFromScript(),
): readonly string[] => {
  const callerBase = argument("--comparison-base");
  const requestedManifest =
    argument("--publication-manifest") ?? canonicalManifestPath;
  if (!callerBase) throw new Error("Missing --comparison-base");
  if (requestedManifest !== canonicalManifestPath) {
    throw new Error(`Publication manifest must be ${canonicalManifestPath}`);
  }
  const current = parseManifest(
    readFileSync(resolve(repoRoot, canonicalManifestPath), "utf8"),
  );
  const actualMergeBase = git(repoRoot, [
    "merge-base",
    "HEAD",
    current.trustedComparisonRef,
  ]);
  validateComparisonBase(callerBase, actualMergeBase);
  const findings = [
    ...verifyPublicationManifestChecksum(current),
    ...findWorkingTreePublicationDrift(repoRoot, current),
  ];
  try {
    const trusted = parseManifest(
      git(repoRoot, ["show", `${actualMergeBase}:${canonicalManifestPath}`]),
    );
    findings.push(...verifyPublicationManifestChecksum(trusted));
    findings.push(...compareTrustedPublications(trusted, current));
  } catch {
    // The first publication manifest establishes the trusted baseline.
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
