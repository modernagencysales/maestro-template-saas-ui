import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { format } from "prettier";

import { buildWorkflowFiles } from "./workflow-files";
import {
  buildAuthoritativeSourceClosure,
  checksumReleaseDescriptor,
  descriptorWithAuthoritativeSource,
  type ReleaseDescriptor,
} from "./workflow-release-commands";
import {
  checksumSourceClosure,
  isMutableGeneratedProjection,
  normalizedSourcePath,
} from "./workflow-source-closure";

type PublicationEntry = {
  readonly kind: "workflow" | "capability";
  readonly logicalId: string;
  readonly version: number;
  readonly lifecycle: "published";
  readonly isolatedFixture: boolean;
  readonly fingerprint: Readonly<Record<string, string>>;
  readonly sourceClosure: ReleaseDescriptor["sourceClosure"];
  readonly artifacts: readonly {
    readonly class: ReleaseDescriptor["artifacts"][number]["class"];
    readonly path: string;
    readonly checksum: string;
  }[];
};

type PublicationManifest = {
  readonly schemaVersion: 1;
  readonly entries: readonly PublicationEntry[];
  readonly manifestChecksum: string;
};

type PublishedClosureInput = {
  readonly path: string;
  readonly checksum: string;
};

export type PinnedIsolatedPublicationAuthority = Readonly<{
  tag: string;
  tagObject: string;
  commit: string;
}>;

export type WorkflowPublicationGenerationResult = {
  readonly files: readonly {
    readonly path: string;
    readonly content: string;
  }[];
  readonly drift: readonly string[];
  readonly publicationCount: number;
};

const capabilityDescriptorPath =
  "packages/convex/confect/capabilities/_versions/publicationEcho/v1.publication.json";
const capabilityReleasePath =
  "packages/convex/confect/capabilities/_versions/publicationEcho/v1.release.ts";
const capabilityAuthorityPath =
  "packages/convex/confect/capabilities/_versions/publicationEcho/v1.authority.ts";
const workflowDescriptorPath =
  "packages/convex/confect/workflows/publicationFixture/v1.publication.json";
const workflowReleasePath =
  "packages/convex/confect/workflows/publicationFixture/v1.release.ts";
const workflowAuthorityPath =
  "packages/convex/confect/workflows/publicationFixture/v1.authority.ts";
const manifestPath = "docs/template/generated/workflow-publications.json";
const provenancePath =
  "docs/template/generated/provenance/add-workflow/publicationFixture.json";
const immutablePublishedPaths = [
  provenancePath,
  manifestPath,
  "docs/template/generated/workflows/publicationFixture.md",
  "docs/template/generated/workflows/publicationFixture.semantics.json",
  capabilityAuthorityPath,
  capabilityDescriptorPath,
  capabilityReleasePath,
  workflowAuthorityPath,
  workflowDescriptorPath,
  workflowReleasePath,
] as const;
const unreleasedFixtureTag = "maestro-template-v0.2.0-alpha.1";

export const PINNED_ISOLATED_PUBLICATION_AUTHORITY = Object.freeze({
  tag: unreleasedFixtureTag,
  tagObject: "d7fefbdcf2c30fb5c9e7b7d6c5b83c31c93e55f8",
  commit: "35c5bd1b1b011320f5790eca7bd1356174b20fc9",
}) satisfies PinnedIsolatedPublicationAuthority;

export const assertUnreleasedV1RepairAllowed = (cwd: string): void => {
  const matchingTags = execFileSync(
    "git",
    ["-C", cwd, "tag", "--list", unreleasedFixtureTag],
    { encoding: "utf8" },
  ).trim();
  if (matchingTags !== "") {
    throw new Error(
      `Refusing to repair published V1 fixtures after ${unreleasedFixtureTag} exists`,
    );
  }
};

const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

export const findPublishedClosureDrift = (
  cwd: string,
  inputs: readonly {
    readonly path: string;
    readonly checksum: string;
  }[],
): readonly string[] =>
  inputs
    .filter(
      ({ path }) => !isMutableGeneratedProjection(cwd, resolve(cwd, path)),
    )
    .filter(({ path, checksum }) => {
      try {
        return sha256(readFileSync(resolve(cwd, path))) !== checksum;
      } catch {
        return true;
      }
    })
    .map(({ path }) => path);

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

type PinnedGitTree = Readonly<{
  read: (path: string) => Buffer;
}>;

const gitText = (
  cwd: string,
  args: readonly string[],
  failure: string,
): string => {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error(failure);
  }
};

const safePinnedPath = (cwd: string, path: string): string => {
  const normalized = normalizedSourcePath(cwd, resolve(cwd, path));
  if (normalized !== path || path.length === 0) {
    throw new Error(`Unsafe pinned isolated publication path: ${path}`);
  }
  return normalized;
};

const openPinnedGitTree = (
  cwd: string,
  authority: PinnedIsolatedPublicationAuthority,
): PinnedGitTree => {
  const tagRef = `refs/tags/${authority.tag}`;
  const actualTagObject = gitText(
    cwd,
    ["rev-parse", "--verify", tagRef],
    `Pinned isolated publication tag is unavailable: ${authority.tag}`,
  );
  if (actualTagObject !== authority.tagObject) {
    throw new Error(
      `Pinned isolated publication tag object mismatch: expected ${authority.tagObject}, received ${actualTagObject}`,
    );
  }
  const objectType = gitText(
    cwd,
    ["cat-file", "-t", actualTagObject],
    `Pinned isolated publication tag object is unavailable: ${actualTagObject}`,
  );
  if (objectType !== "tag") {
    throw new Error(
      `Pinned isolated publication authority must be an annotated tag: ${authority.tag}`,
    );
  }
  const actualCommit = gitText(
    cwd,
    ["rev-parse", "--verify", `${tagRef}^{commit}`],
    `Pinned isolated publication commit is unavailable: ${authority.tag}`,
  );
  if (actualCommit !== authority.commit) {
    throw new Error(
      `Pinned isolated publication commit mismatch: expected ${authority.commit}, received ${actualCommit}`,
    );
  }

  const blobs = new Map<string, Buffer>();
  return {
    read: (path) => {
      const safePath = safePinnedPath(cwd, path);
      const cached = blobs.get(safePath);
      if (cached !== undefined) return cached;
      try {
        const body = execFileSync(
          "git",
          ["-C", cwd, "cat-file", "blob", `${actualCommit}:${safePath}`],
          { stdio: ["ignore", "pipe", "pipe"] },
        );
        blobs.set(safePath, body);
        return body;
      } catch {
        throw new Error(
          `Pinned isolated publication blob is unavailable: ${safePath}`,
        );
      }
    },
  };
};

const readPinnedJson = <Value>(tree: PinnedGitTree, path: string): Value => {
  try {
    return JSON.parse(tree.read(path).toString("utf8")) as Value;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Pinned isolated publication blob")
    ) {
      throw error;
    }
    throw new Error(`Pinned isolated publication JSON is invalid: ${path}`);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const artifactClasses = new Set([
  "graph",
  "runner",
  "event",
  "completion",
  "capability",
  "dependency",
  "interpreter",
  "registry",
]);

const assertPinnedIsolatedPublicationDescriptor = (
  cwd: string,
  value: unknown,
  path: string,
): ReleaseDescriptor => {
  if (
    !isRecord(value) ||
    (value.kind !== "workflow" && value.kind !== "capability") ||
    typeof value.logicalId !== "string" ||
    typeof value.name !== "string" ||
    !Number.isSafeInteger(value.version) ||
    !isRecord(value.releaseContent) ||
    !isRecord(value.fingerprint) ||
    !Object.values(value.fingerprint).every(
      (fingerprint) => typeof fingerprint === "string",
    ) ||
    !Array.isArray(value.dependencies) ||
    !Array.isArray(value.artifacts) ||
    !isRecord(value.sourceClosure) ||
    !Array.isArray(value.sourceClosure.roots) ||
    !value.sourceClosure.roots.every((root) => typeof root === "string") ||
    !Array.isArray(value.sourceClosure.modules) ||
    typeof value.sourceClosure.checksum !== "string"
  ) {
    throw new Error(`Pinned publication descriptor is malformed: ${path}`);
  }
  const descriptor = value as ReleaseDescriptor;
  if (
    descriptor.lifecycle !== "published" ||
    descriptor.isolatedFixture !== true ||
    descriptor.semanticComplete !== true
  ) {
    throw new Error(
      `Pinned publication descriptor is not a complete published isolated fixture: ${path}`,
    );
  }
  if (
    !descriptor.sourceClosure.modules.every(
      (module) =>
        isRecord(module) &&
        typeof module.path === "string" &&
        /^[0-9a-f]{64}$/.test(String(module.checksum)),
    ) ||
    !descriptor.artifacts.every(
      (artifact) =>
        isRecord(artifact) &&
        artifactClasses.has(String(artifact.class)) &&
        typeof artifact.path === "string",
    ) ||
    !descriptor.dependencies.every(
      (dependency) =>
        isRecord(dependency) &&
        (dependency.kind === "workflow" || dependency.kind === "capability") &&
        typeof dependency.logicalId === "string" &&
        Number.isSafeInteger(dependency.version) &&
        typeof dependency.releaseChecksum === "string" &&
        /^[0-9a-f]{64}$/.test(dependency.releaseChecksum),
    )
  ) {
    throw new Error(`Pinned publication descriptor is malformed: ${path}`);
  }
  const modulePaths = new Set<string>();
  for (const module of descriptor.sourceClosure.modules) {
    safePinnedPath(cwd, module.path);
    if (modulePaths.has(module.path)) {
      throw new Error(
        `Pinned publication source closure contains a duplicate path: ${module.path}`,
      );
    }
    modulePaths.add(module.path);
  }
  for (const root of descriptor.sourceClosure.roots) {
    if (!modulePaths.has(root)) {
      throw new Error(
        `Pinned publication source closure omits root module: ${root}`,
      );
    }
  }
  for (const artifact of descriptor.artifacts) {
    if (artifact.class !== "registry" && !modulePaths.has(artifact.path)) {
      throw new Error(
        `Pinned publication source closure omits ${artifact.class} artifact: ${artifact.path}`,
      );
    }
  }
  return descriptor;
};

const matchingPinnedEntry = (
  manifest: PublicationManifest,
  descriptor: ReleaseDescriptor,
): PublicationEntry => {
  const entries = manifest.entries.filter(
    (entry) =>
      entry.kind === descriptor.kind &&
      entry.logicalId === descriptor.logicalId &&
      entry.version === descriptor.version,
  );
  if (entries.length !== 1 || entries[0] === undefined) {
    throw new Error(
      `Pinned isolated publication manifest requires exactly one entry for ${descriptor.logicalId}@v${descriptor.version}`,
    );
  }
  const entry = entries[0];
  const descriptorIdentity = {
    kind: descriptor.kind,
    logicalId: descriptor.logicalId,
    version: descriptor.version,
    lifecycle: descriptor.lifecycle,
    isolatedFixture: descriptor.isolatedFixture,
    fingerprint: descriptor.fingerprint,
    sourceClosure: descriptor.sourceClosure,
    artifacts: descriptor.artifacts,
  };
  const entryIdentity = {
    kind: entry.kind,
    logicalId: entry.logicalId,
    version: entry.version,
    lifecycle: entry.lifecycle,
    isolatedFixture: entry.isolatedFixture,
    fingerprint: entry.fingerprint,
    sourceClosure: entry.sourceClosure,
    artifacts: entry.artifacts.map(({ class: artifactClass, path }) => ({
      class: artifactClass,
      path,
    })),
  };
  if (canonicalJson(descriptorIdentity) !== canonicalJson(entryIdentity)) {
    throw new Error(
      `Pinned isolated publication manifest entry does not match descriptor: ${descriptor.logicalId}@v${descriptor.version}`,
    );
  }
  return entry;
};

const assertPinnedDescriptorChecksums = (
  descriptor: ReleaseDescriptor,
  entry: PublicationEntry,
): void => {
  const closureChecksum = checksumSourceClosure(descriptor.sourceClosure);
  if (
    closureChecksum !== descriptor.sourceClosure.checksum ||
    descriptor.fingerprint.sourceClosure !== closureChecksum ||
    descriptor.releaseContent.sourceClosureChecksum !== closureChecksum
  ) {
    throw new Error(
      `Pinned isolated publication source-closure checksum is invalid: ${descriptor.logicalId}@v${descriptor.version}`,
    );
  }
  const authorityChecksum = sha256(
    canonicalJson({
      schemaVersion: 1,
      kind: descriptor.kind,
      logicalId: descriptor.logicalId,
      version: descriptor.version,
      sourceClosure: descriptor.sourceClosure,
    }),
  );
  if (
    descriptor.fingerprint.authorityChecksum !== authorityChecksum ||
    descriptor.releaseContent.authorityChecksum !== authorityChecksum
  ) {
    throw new Error(
      `Pinned isolated publication authority checksum is invalid: ${descriptor.logicalId}@v${descriptor.version}`,
    );
  }
  if (
    descriptor.fingerprint.releaseChecksum !==
    checksumReleaseDescriptor(descriptor)
  ) {
    throw new Error(
      `Pinned isolated publication release checksum is invalid: ${descriptor.logicalId}@v${descriptor.version}`,
    );
  }
  const artifactChecksums = new Map(
    entry.artifacts.map(({ path, checksum }) => [path, checksum]),
  );
  const graph = descriptor.artifacts.find(
    ({ class: artifactClass }) => artifactClass === "graph",
  );
  const graphChecksum = graph && artifactChecksums.get(graph.path);
  if (
    graphChecksum !== undefined &&
    (descriptor.fingerprint.graphHash !== graphChecksum ||
      descriptor.releaseContent.graphHash !== graphChecksum)
  ) {
    throw new Error(
      `Pinned isolated publication graph checksum is invalid: ${descriptor.logicalId}@v${descriptor.version}`,
    );
  }
  const interpreter = descriptor.artifacts.find(
    ({ class: artifactClass }) => artifactClass === "interpreter",
  );
  const interpreterChecksum =
    interpreter && artifactChecksums.get(interpreter.path);
  const releaseInterpreter = descriptor.releaseContent.interpreter;
  if (
    interpreterChecksum !== undefined &&
    (descriptor.fingerprint.interpreter !== interpreterChecksum ||
      typeof releaseInterpreter !== "object" ||
      releaseInterpreter === null ||
      !("checksum" in releaseInterpreter) ||
      releaseInterpreter.checksum !== interpreterChecksum)
  ) {
    throw new Error(
      `Pinned isolated publication interpreter checksum is invalid: ${descriptor.logicalId}@v${descriptor.version}`,
    );
  }
  const dependencyArtifacts = descriptor.artifacts
    .filter(({ class: artifactClass }) => artifactClass === "dependency")
    .map(({ path }) => ({ path, checksum: artifactChecksums.get(path) ?? "" }))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (
    descriptor.fingerprint.dependencyManifest !==
    sha256(canonicalJson(dependencyArtifacts))
  ) {
    throw new Error(
      `Pinned isolated publication dependency checksum is invalid: ${descriptor.logicalId}@v${descriptor.version}`,
    );
  }
};

const validatePinnedTaggedInputs = (
  tree: PinnedGitTree,
  inputs: readonly PublishedClosureInput[],
): void => {
  const checksums = new Map<string, string>();
  for (const input of inputs) {
    const previous = checksums.get(input.path);
    if (previous !== undefined && previous !== input.checksum) {
      throw new Error(
        `Pinned isolated publication has conflicting checksums: ${input.path}`,
      );
    }
    checksums.set(input.path, input.checksum);
  }
  for (const [path, checksum] of checksums) {
    if (!/^[0-9a-f]{64}$/.test(checksum)) {
      throw new Error(
        `Pinned isolated publication checksum is malformed: ${path}`,
      );
    }
    if (sha256(tree.read(path)) !== checksum) {
      throw new Error(`Tagged isolated publication checksum mismatch: ${path}`);
    }
  }
};

export const findCurrentPublicationMetadataDrift = (
  cwd: string,
  taggedFiles: readonly {
    readonly path: string;
    readonly content: Buffer;
  }[],
): readonly string[] =>
  taggedFiles
    .filter(({ path, content }) => {
      safePinnedPath(cwd, path);
      try {
        return !readFileSync(resolve(cwd, path)).equals(content);
      } catch {
        return true;
      }
    })
    .map(({ path }) => path);

const validatePinnedIsolatedPublicationInputs = (
  cwd: string,
  inputs: readonly PublishedClosureInput[],
  authority: PinnedIsolatedPublicationAuthority = PINNED_ISOLATED_PUBLICATION_AUTHORITY,
): void => {
  const tree = openPinnedGitTree(cwd, authority);
  validatePinnedTaggedInputs(tree, inputs);
};

/** @internal Focused fail-closed regression seams; production uses the exact full builder. */
export const pinnedPublicationAuthorityTestSeams = Object.freeze({
  assertDescriptor: assertPinnedIsolatedPublicationDescriptor,
  validateInputs: validatePinnedIsolatedPublicationInputs,
});

const loadPinnedIsolatedPublication = (
  cwd: string,
): Readonly<{
  tree: PinnedGitTree;
  inputs: readonly PublishedClosureInput[];
}> => {
  const tree = openPinnedGitTree(cwd, PINNED_ISOLATED_PUBLICATION_AUTHORITY);
  const capability = assertPinnedIsolatedPublicationDescriptor(
    cwd,
    readPinnedJson<unknown>(tree, capabilityDescriptorPath),
    capabilityDescriptorPath,
  );
  const workflow = assertPinnedIsolatedPublicationDescriptor(
    cwd,
    readPinnedJson<unknown>(tree, workflowDescriptorPath),
    workflowDescriptorPath,
  );
  const manifest = readPinnedJson<PublicationManifest>(tree, manifestPath);
  if (
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.entries) ||
    manifest.entries.length !== 2 ||
    !/^[0-9a-f]{64}$/.test(manifest.manifestChecksum)
  ) {
    throw new Error("Pinned isolated publication manifest is malformed");
  }
  if (
    sha256(
      canonicalJson({
        schemaVersion: manifest.schemaVersion,
        entries: manifest.entries,
      }),
    ) !== manifest.manifestChecksum
  ) {
    throw new Error("Pinned isolated publication manifest checksum is invalid");
  }
  const capabilityEntry = matchingPinnedEntry(manifest, capability);
  const workflowEntry = matchingPinnedEntry(manifest, workflow);
  assertPinnedDescriptorChecksums(capability, capabilityEntry);
  assertPinnedDescriptorChecksums(workflow, workflowEntry);
  return {
    tree,
    inputs: [capability, workflow].flatMap((descriptor) => {
      const entry =
        descriptor.kind === "capability" ? capabilityEntry : workflowEntry;
      return [
        ...descriptor.sourceClosure.modules,
        ...entry.artifacts.map(({ path, checksum }) => ({ path, checksum })),
      ];
    }),
  };
};

const readJson = <Value>(cwd: string, path: string): Value =>
  JSON.parse(readFileSync(resolve(cwd, path), "utf8")) as Value;

const jsonFile = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

const replaceKnownValues = (
  source: string,
  before: ReleaseDescriptor,
  after: ReleaseDescriptor,
): string => {
  let rendered = source;
  const replacements = new Map<string, string>();
  for (const [field, value] of Object.entries(before.fingerprint)) {
    const next = after.fingerprint[field];
    if (next && value !== next) replacements.set(value, next);
  }
  before.dependencies.forEach((dependency, index) => {
    const next = after.dependencies[index]?.releaseChecksum;
    if (next && dependency.releaseChecksum !== next) {
      replacements.set(dependency.releaseChecksum, next);
    }
  });
  for (const [from, to] of replacements)
    rendered = rendered.replaceAll(from, to);
  return rendered;
};

const replaceReleaseChecksumField = (
  source: string,
  field: "sourceClosureChecksum" | "releaseChecksum",
  value: string,
): string => {
  const marker = `${field}:`;
  const fieldStart = source.lastIndexOf(marker);
  if (fieldStart < 0) {
    throw new Error(`Generated release field is unavailable: ${field}`);
  }
  const valueStart = source.indexOf('"', fieldStart + marker.length);
  const valueEnd = valueStart < 0 ? -1 : source.indexOf('"', valueStart + 1);
  const current =
    valueStart < 0 || valueEnd < 0
      ? ""
      : source.slice(valueStart + 1, valueEnd);
  if (!/^[0-9a-f]{64}$/.test(current) || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Generated release ${field} must be a SHA-256 checksum`);
  }
  return `${source.slice(0, valueStart + 1)}${value}${source.slice(valueEnd)}`;
};

export const synchronizeReleaseAuthorityChecksums = (
  source: string,
  descriptor: Pick<ReleaseDescriptor, "fingerprint" | "sourceClosure">,
): string => {
  const releaseChecksum = descriptor.fingerprint.releaseChecksum;
  if (!releaseChecksum) {
    throw new Error("Generated release checksum is unavailable");
  }
  return replaceReleaseChecksumField(
    replaceReleaseChecksumField(
      source,
      "sourceClosureChecksum",
      descriptor.sourceClosure.checksum,
    ),
    "releaseChecksum",
    releaseChecksum,
  );
};

const withRunnerFunctionReference = (
  source: string,
  functionReference: string,
): string => {
  const runnerStart = source.indexOf("  runner: {");
  const runnerEnd = source.indexOf("\n  },\n  events:", runnerStart);
  if (runnerStart < 0 || runnerEnd < 0) {
    throw new Error("Generated workflow release runner block is unavailable");
  }
  const runnerBlock = source.slice(runnerStart, runnerEnd);
  if (runnerBlock.includes("functionReference:")) return source;
  return `${source.slice(0, runnerEnd)}\n    functionReference: ${JSON.stringify(functionReference)},${source.slice(runnerEnd)}`;
};

const renderAuthority = async (
  descriptor: ReleaseDescriptor,
): Promise<string> => {
  const variable =
    descriptor.kind === "workflow"
      ? `${descriptor.name}V${descriptor.version}Authority`
      : `${descriptor.name}V${descriptor.version}Authority`;
  const importPath =
    descriptor.kind === "workflow"
      ? "../_kit/publication"
      : "../../../workflows/_kit/publication";
  const authority = {
    schemaVersion: 1,
    descriptorChecksum: descriptor.fingerprint.authorityChecksum,
    sourceClosure: descriptor.sourceClosure,
  };
  return format(
    `import type { GeneratedPublicationAuthority } from ${JSON.stringify(importPath)};\n\nexport const ${variable} = ${JSON.stringify(authority, null, 2)} as const satisfies GeneratedPublicationAuthority;\n`,
    { filepath: `${descriptor.name}.authority.ts` },
  );
};

const refreshDescriptor = (
  cwd: string,
  descriptor: ReleaseDescriptor,
): ReleaseDescriptor => {
  const sourceClosure = buildAuthoritativeSourceClosure(
    cwd,
    descriptor.sourceClosure.roots,
  );
  return descriptorWithAuthoritativeSource(cwd, descriptor, sourceClosure);
};

const updateWorkflowDependency = (
  descriptor: ReleaseDescriptor,
  capability: ReleaseDescriptor,
): ReleaseDescriptor => {
  const dependencyChecksum = capability.fingerprint.releaseChecksum;
  if (!dependencyChecksum) {
    throw new Error("Generated capability release checksum is unavailable");
  }
  const dependencies = descriptor.dependencies.map((dependency) =>
    dependency.kind === "capability" &&
    dependency.logicalId === capability.logicalId &&
    dependency.version === capability.version
      ? { ...dependency, releaseChecksum: dependencyChecksum }
      : dependency,
  );
  const releaseContent = {
    ...descriptor.releaseContent,
    runnerFunctionReference: descriptor.fingerprint.runnerRef,
    capabilityBindings: Array.isArray(
      descriptor.releaseContent.capabilityBindings,
    )
      ? descriptor.releaseContent.capabilityBindings.map((binding) =>
          typeof binding === "object" &&
          binding !== null &&
          "logicalKey" in binding &&
          binding.logicalKey === capability.logicalId &&
          "version" in binding &&
          binding.version === capability.version
            ? { ...binding, releaseChecksum: dependencyChecksum }
            : binding,
        )
      : descriptor.releaseContent.capabilityBindings,
  };
  return {
    ...descriptor,
    dependencies,
    releaseContent,
    fingerprint: {
      ...descriptor.fingerprint,
      capabilityBindings:
        dependencies
          .filter(({ kind }) => kind === "capability")
          .map(
            ({ logicalId, version, releaseChecksum }) =>
              `${logicalId}@v${version}:${releaseChecksum}`,
          )
          .join(",") || "none",
    },
  };
};

const publicationEntry = (
  cwd: string,
  descriptor: ReleaseDescriptor,
  generated: ReadonlyMap<string, string>,
): PublicationEntry => ({
  kind: descriptor.kind,
  logicalId: descriptor.logicalId,
  version: descriptor.version,
  lifecycle: "published",
  isolatedFixture: descriptor.isolatedFixture,
  fingerprint: descriptor.fingerprint,
  sourceClosure: descriptor.sourceClosure,
  artifacts: descriptor.artifacts.map((artifact) => ({
    ...artifact,
    checksum: sha256(
      generated.get(artifact.path) ??
        readFileSync(resolve(cwd, artifact.path), "utf8"),
    ),
  })),
});

const generatedWorkflowDocs = async (): Promise<
  ReadonlyMap<string, string>
> => {
  const result = buildWorkflowFiles({
    name: "publicationFixture",
    system: "workflow-runtime",
    disposition: "extend",
    description: "Isolated immutable publication contract fixture.",
  });
  const wanted = result.files.filter(
    ({ path }) =>
      path === "docs/template/generated/workflows/publicationFixture.md" ||
      path ===
        "docs/template/generated/workflows/publicationFixture.semantics.json" ||
      path === provenancePath,
  );
  return new Map(
    await Promise.all(
      wanted.map(
        async ({ path, content }) =>
          [
            path,
            await format(content, {
              filepath: path,
              printWidth: 80,
              proseWrap: "always",
            }),
          ] as const,
      ),
    ),
  );
};

export const buildWorkflowPublicationStack = async (
  cwd: string,
  options: { readonly repairUnreleasedV1?: boolean } = {},
): Promise<WorkflowPublicationGenerationResult> => {
  if (!options.repairUnreleasedV1) {
    const pinned = loadPinnedIsolatedPublication(cwd);
    validatePinnedTaggedInputs(pinned.tree, pinned.inputs);
    const taggedMetadata = immutablePublishedPaths.map((path) => ({
      path,
      content: pinned.tree.read(path),
    }));
    return {
      files: immutablePublishedPaths.map((path) => ({
        path,
        content: readFileSync(resolve(cwd, path), "utf8"),
      })),
      drift: findCurrentPublicationMetadataDrift(cwd, taggedMetadata),
      publicationCount: 2,
    };
  }
  const currentCapability = readJson<ReleaseDescriptor>(
    cwd,
    capabilityDescriptorPath,
  );
  const currentWorkflow = readJson<ReleaseDescriptor>(
    cwd,
    workflowDescriptorPath,
  );
  if (
    currentCapability.lifecycle !== "published" ||
    currentWorkflow.lifecycle !== "published"
  ) {
    throw new Error("Unreleased V1 repair requires published fixtures");
  }
  assertUnreleasedV1RepairAllowed(cwd);
  const capability = refreshDescriptor(cwd, currentCapability);
  const workflow = refreshDescriptor(
    cwd,
    updateWorkflowDependency(currentWorkflow, capability),
  );

  const generated = new Map<string, string>();
  const capabilityRelease = await format(
    synchronizeReleaseAuthorityChecksums(
      replaceKnownValues(
        readFileSync(resolve(cwd, capabilityReleasePath), "utf8"),
        currentCapability,
        capability,
      ),
      capability,
    ),
    { filepath: capabilityReleasePath },
  );
  generated.set(capabilityReleasePath, capabilityRelease);
  generated.set(capabilityAuthorityPath, await renderAuthority(capability));
  generated.set(capabilityDescriptorPath, jsonFile(capability));

  const workflowRelease = await format(
    withRunnerFunctionReference(
      synchronizeReleaseAuthorityChecksums(
        replaceKnownValues(
          readFileSync(resolve(cwd, workflowReleasePath), "utf8"),
          currentWorkflow,
          workflow,
        ),
        workflow,
      ),
      String(workflow.releaseContent.runnerFunctionReference),
    ),
    { filepath: workflowReleasePath },
  );
  generated.set(workflowReleasePath, workflowRelease);
  generated.set(workflowAuthorityPath, await renderAuthority(workflow));
  generated.set(
    workflowDescriptorPath,
    await format(jsonFile(workflow), {
      filepath: workflowDescriptorPath,
      printWidth: 80,
      proseWrap: "always",
    }),
  );

  const entries = [
    publicationEntry(cwd, capability, generated),
    publicationEntry(cwd, workflow, generated),
  ];
  const unsignedManifest = { schemaVersion: 1 as const, entries };
  const manifestChecksum = sha256(canonicalJson(unsignedManifest));
  generated.set(
    manifestPath,
    jsonFile({ ...unsignedManifest, manifestChecksum }),
  );

  const docs = await generatedWorkflowDocs();
  const generatedProvenance = JSON.parse(
    docs.get(provenancePath) ?? "{}",
  ) as Record<string, unknown>;
  const capabilityAuthorityArtifactChecksum = sha256(
    generated.get(capabilityAuthorityPath) ?? "",
  );
  const workflowAuthorityArtifactChecksum = sha256(
    generated.get(workflowAuthorityPath) ?? "",
  );
  generated.set(
    provenancePath,
    jsonFile({
      ...generatedProvenance,
      publication: {
        lifecycle: "published",
        isolatedFixture: true,
        workflowVersion: workflow.version,
        capabilities: [
          {
            logicalKey: "publicationEcho",
            version: capability.version,
            authorityArtifactChecksum: capabilityAuthorityArtifactChecksum,
            releaseChecksum: capability.fingerprint.releaseChecksum,
          },
        ],
        manifestPath,
        manifestChecksum,
        authorityChecksum: workflow.fingerprint.authorityChecksum,
        authorityArtifactChecksum: workflowAuthorityArtifactChecksum,
        sourceClosureChecksum: workflow.sourceClosure.checksum,
        releaseChecksum: workflow.fingerprint.releaseChecksum,
      },
    }),
  );
  for (const [path, content] of docs) {
    if (path !== provenancePath) generated.set(path, content);
  }

  const files = [...generated]
    .map(([path, content]) => ({ path, content }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const drift = files
    .filter(
      ({ path, content }) =>
        readFileSync(resolve(cwd, path), "utf8") !== content,
    )
    .map(({ path }) => path);
  return { files, drift, publicationCount: entries.length };
};

export const regenerateWorkflowPublicationStack = async (
  cwd: string,
  write: boolean,
  options: { readonly repairUnreleasedV1?: boolean } = {},
): Promise<WorkflowPublicationGenerationResult> => {
  const result = await buildWorkflowPublicationStack(cwd, options);
  if (write) {
    for (const file of result.files) {
      const target = resolve(cwd, file.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content);
    }
  }
  return result;
};

const isDirectRun = (): boolean =>
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;

if (isDirectRun()) {
  const write = process.argv.includes("--write");
  const repairUnreleasedV1 = process.argv.includes("--repair-unreleased-v1");
  if (repairUnreleasedV1 && !write) {
    throw new Error("--repair-unreleased-v1 requires --write");
  }
  const result = await regenerateWorkflowPublicationStack(
    process.cwd(),
    write,
    { repairUnreleasedV1 },
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        publicationCount: result.publicationCount,
        generatedFileCount: result.files.length,
        driftCount: result.drift.length,
        drift: result.drift,
        wrote: write,
        repairedUnreleasedV1: repairUnreleasedV1,
      },
      null,
      2,
    )}\n`,
  );
  if (!write && result.drift.length > 0) process.exitCode = 1;
}
