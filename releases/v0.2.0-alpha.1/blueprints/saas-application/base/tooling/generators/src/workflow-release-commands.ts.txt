import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  buildResolvedSourceClosure,
  type SourceClosure,
} from "./workflow-source-closure";

export type { SourceClosure } from "./workflow-source-closure";

type ReleaseKind = "workflow" | "capability";
type Lifecycle = "draft" | "published" | "retired";
type ArtifactClass =
  | "graph"
  | "runner"
  | "event"
  | "completion"
  | "capability"
  | "dependency"
  | "interpreter"
  | "registry";

export type ReleaseDescriptor = {
  readonly kind: ReleaseKind;
  readonly logicalId: string;
  readonly name: string;
  readonly version: number;
  readonly lifecycle: Lifecycle;
  readonly semanticComplete: boolean;
  readonly isolatedFixture: boolean;
  readonly releaseContent: Readonly<Record<string, unknown>>;
  readonly fingerprint: Readonly<Record<string, string>>;
  readonly dependencies: readonly {
    readonly kind: ReleaseKind;
    readonly logicalId: string;
    readonly version: number;
    readonly releaseChecksum: string;
  }[];
  readonly artifacts: readonly {
    readonly class: ArtifactClass;
    readonly path: string;
  }[];
  readonly sourceClosure: SourceClosure;
};

type PublicationEntry = Omit<
  ReleaseDescriptor,
  "name" | "semanticComplete" | "releaseContent" | "dependencies" | "artifacts"
> & {
  readonly artifacts: readonly {
    readonly class: ArtifactClass;
    readonly path: string;
    readonly checksum: string;
  }[];
};

type PublicationManifest = {
  readonly schemaVersion: 1;
  readonly entries: readonly PublicationEntry[];
  readonly manifestChecksum: string;
};

const manifestPath = "docs/template/generated/workflow-publications.json";

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

const checksumManifest = (
  manifest: Omit<PublicationManifest, "manifestChecksum">,
) => sha256(canonicalJson(manifest));

export const buildAuthoritativeSourceClosure = (
  cwd: string,
  roots: readonly string[],
  overlay: ReadonlyMap<string, string> = new Map(),
): SourceClosure => buildResolvedSourceClosure(cwd, roots, overlay);

const assertAuthoritativeSourceClosure = (
  cwd: string,
  declared: SourceClosure,
  overlay: ReadonlyMap<string, string> = new Map(),
): SourceClosure => {
  const actual = buildAuthoritativeSourceClosure(cwd, declared.roots, overlay);
  if (canonicalJson(actual) !== canonicalJson(declared)) {
    throw new Error(
      "Declared source closure does not match complete resolved repository bytes",
    );
  }
  return actual;
};

const positiveVersion = (value: string | undefined, label: string): number => {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return version;
};

const descriptorPath = (kind: ReleaseKind, name: string, version: number) =>
  kind === "workflow"
    ? `packages/convex/confect/workflows/${name}/v${version}.publication.json`
    : `packages/convex/confect/capabilities/_versions/${name}/v${version}.publication.json`;

const releasePath = (kind: ReleaseKind, name: string, version: number) =>
  kind === "workflow"
    ? `packages/convex/confect/workflows/${name}/v${version}.release.ts`
    : `packages/convex/confect/capabilities/_versions/${name}/v${version}.release.ts`;

const versionedPaths = (
  kind: ReleaseKind,
  name: string,
  version: number,
): readonly string[] =>
  kind === "workflow"
    ? [
        `packages/convex/confect/workflows/${name}/v${version}.graph.ts`,
        `packages/convex/confect/workflows/${name}/v${version}.registry.ts`,
        `packages/convex/confect/workflowRunners/${name}/v${version}.ts`,
        `packages/convex/confect/workflowRunners/${name}/v${version}.spec.ts`,
        `packages/convex/confect/workflowRunners/${name}/v${version}.impl.ts`,
        releasePath(kind, name, version),
        descriptorPath(kind, name, version),
      ]
    : [
        `packages/convex/confect/capabilities/_versions/${name}/v${version}.spec.ts`,
        `packages/convex/confect/capabilities/_versions/${name}/v${version}.impl.ts`,
        `packages/convex/confect/capabilities/_versions/${name}/v${version}.operation.ts`,
        releasePath(kind, name, version),
        descriptorPath(kind, name, version),
      ];

const readJson = <Value>(cwd: string, path: string): Value =>
  JSON.parse(readFileSync(resolve(cwd, path), "utf8")) as Value;

const write = (cwd: string, path: string, content: string): void => {
  const target = resolve(cwd, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
};

const bumpSource = (source: string, from: number, to: number): string =>
  source
    .replaceAll(`/v${from}`, `/v${to}`)
    .replaceAll(`./v${from}`, `./v${to}`)
    .replaceAll(` v${from}`, ` v${to}`)
    .replaceAll(`version: ${from}`, `version: ${to}`)
    .replaceAll(`capabilityVersion: ${from}`, `capabilityVersion: ${to}`)
    .replace('lifecycle: "published"', 'lifecycle: "draft"')
    .replace('lifecycle: "retired"', 'lifecycle: "draft"');

const stepNames = (source: string): readonly string[] =>
  [...source.matchAll(/stepName:\s*"([^"]+)"/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );

export const bumpRelease = (input: {
  readonly cwd: string;
  readonly kind: ReleaseKind;
  readonly name: string;
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly write: boolean;
}) => {
  const from = positiveVersion(input.from, "--from");
  const to = positiveVersion(input.to, "--to");
  if (to !== from + 1) throw new Error("Release bumps must increment by one");
  const sourceDescriptor = readJson<ReleaseDescriptor>(
    input.cwd,
    descriptorPath(input.kind, input.name, from),
  );
  if (
    sourceDescriptor.lifecycle !== "published" &&
    sourceDescriptor.lifecycle !== "retired"
  ) {
    throw new Error("Only a published or retired release can be bumped");
  }
  const sourceClosure = assertAuthoritativeSourceClosure(
    input.cwd,
    sourceDescriptor.sourceClosure,
  );
  assertAuthoritativeFingerprint(input.cwd, sourceDescriptor, sourceClosure);
  const sourcePaths = versionedPaths(input.kind, input.name, from);
  const targetPaths = versionedPaths(input.kind, input.name, to);
  const files = sourcePaths.map((sourcePath, index) => {
    const targetPath = targetPaths[index];
    if (!targetPath) throw new Error("Versioned release path mapping failed");
    if (!existsSync(resolve(input.cwd, sourcePath))) {
      throw new Error(`Published release source is missing: ${sourcePath}`);
    }
    if (existsSync(resolve(input.cwd, targetPath))) {
      throw new Error(`Refusing to overwrite release target: ${targetPath}`);
    }
    const content = bumpSource(
      readFileSync(resolve(input.cwd, sourcePath), "utf8"),
      from,
      to,
    );
    return { path: targetPath, content };
  });
  const descriptorFile = files.find(
    ({ path }) => path === descriptorPath(input.kind, input.name, to),
  );
  if (!descriptorFile) throw new Error("Bumped descriptor is missing");
  const descriptor = JSON.parse(descriptorFile.content) as ReleaseDescriptor;
  const bumpedDescriptor: ReleaseDescriptor = {
    ...descriptor,
    version: to,
    lifecycle: "draft",
    fingerprint: Object.fromEntries(
      Object.entries(descriptor.fingerprint).map(([key, value]) => [
        key,
        bumpSource(value, from, to),
      ]),
    ),
    artifacts: descriptor.artifacts.map((artifact) => ({
      ...artifact,
      path: bumpSource(artifact.path, from, to),
    })),
    sourceClosure: {
      ...descriptor.sourceClosure,
      roots: descriptor.sourceClosure.roots.map((root) =>
        bumpSource(root, from, to),
      ),
      modules: descriptor.sourceClosure.modules.map((module) => ({
        ...module,
        path: bumpSource(module.path, from, to),
      })),
    },
  };
  const overlay = new Map(
    files.map(({ path, content }) => [resolve(input.cwd, path), content]),
  );
  const targetClosure = buildAuthoritativeSourceClosure(
    input.cwd,
    bumpedDescriptor.sourceClosure.roots,
    overlay,
  );
  const authoritativeDescriptor = descriptorWithAuthoritativeSource(
    input.cwd,
    bumpedDescriptor,
    targetClosure,
    overlay,
  );
  for (const [field, checksum] of Object.entries(
    authoritativeDescriptor.fingerprint,
  )) {
    const previous = bumpedDescriptor.fingerprint[field];
    if (!previous || previous === checksum) continue;
    for (const file of files) {
      file.content = file.content.replaceAll(previous, checksum);
    }
  }
  descriptorFile.content = `${JSON.stringify(authoritativeDescriptor, null, 2)}\n`;
  overlay.set(resolve(input.cwd, descriptorFile.path), descriptorFile.content);
  assertAuthoritativeFingerprint(
    input.cwd,
    authoritativeDescriptor,
    targetClosure,
    overlay,
  );
  if (input.write) {
    for (const file of files) write(input.cwd, file.path, file.content);
  }
  const graph = files.find(({ path }) => path.endsWith(".graph.ts"));
  const beforeSteps = graph
    ? stepNames(readFileSync(resolve(input.cwd, sourcePaths[0] ?? ""), "utf8"))
    : [];
  const afterSteps = graph ? stepNames(graph.content) : [];
  return {
    kind: input.kind,
    name: input.name,
    from,
    to,
    lifecycle: "draft" as const,
    files,
    stepChanges: {
      added: afterSteps.filter((step) => !beforeSteps.includes(step)),
      removed: beforeSteps.filter((step) => !afterSteps.includes(step)),
      reordered:
        beforeSteps.length === afterSteps.length &&
        beforeSteps.some((step, index) => afterSteps[index] !== step),
    },
  };
};

const requiredFingerprintFields = (kind: ReleaseKind): readonly string[] =>
  kind === "workflow"
    ? [
        "graphHash",
        "runnerRef",
        "kickoffProfiles",
        "capabilityBindings",
        "completionRef",
        "runtimeVersion",
        "sourceClosure",
        "authorityChecksum",
        "stableStepNames",
        "validators",
        "events",
        "options",
        "dependencyManifest",
        "interpreter",
        "releaseChecksum",
      ]
    : [
        "argsSchema",
        "returnSchema",
        "functionRef",
        "effectManifest",
        "dependencyManifest",
        "sourceClosure",
        "authorityChecksum",
        "releaseChecksum",
      ];

export const checksumReleaseDescriptor = (
  descriptor: ReleaseDescriptor,
): string => sha256(canonicalJson(descriptor.releaseContent));

export const descriptorWithAuthoritativeSource = (
  cwd: string,
  descriptor: ReleaseDescriptor,
  sourceClosure: SourceClosure,
  overlay: ReadonlyMap<string, string> = new Map(),
): ReleaseDescriptor => {
  const checksumFor = (path: string): string =>
    sha256(overlay.get(resolve(cwd, path)) ?? readFileSync(resolve(cwd, path)));
  const graph = descriptor.artifacts.find(
    ({ class: artifactClass }) => artifactClass === "graph",
  );
  const interpreter = descriptor.artifacts.find(
    ({ class: artifactClass }) => artifactClass === "interpreter",
  );
  const dependencyArtifacts = descriptor.artifacts
    .filter(({ class: artifactClass }) => artifactClass === "dependency")
    .map(({ path }) => ({ path, checksum: checksumFor(path) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const authorityChecksum = sha256(
    canonicalJson({
      schemaVersion: 1,
      kind: descriptor.kind,
      logicalId: descriptor.logicalId,
      version: descriptor.version,
      sourceClosure,
    }),
  );
  const releaseContent = {
    ...descriptor.releaseContent,
    version: descriptor.version,
    authorityChecksum,
    sourceClosureChecksum: sourceClosure.checksum,
    ...(graph ? { graphHash: checksumFor(graph.path) } : {}),
    ...(interpreter
      ? {
          interpreter: {
            module:
              typeof descriptor.releaseContent.interpreter === "object" &&
              descriptor.releaseContent.interpreter !== null &&
              "module" in descriptor.releaseContent.interpreter
                ? descriptor.releaseContent.interpreter.module
                : interpreter.path,
            checksum: checksumFor(interpreter.path),
          },
        }
      : {}),
    ...(descriptor.kind === "capability"
      ? {
          dependencyManifest: dependencyArtifacts.map(({ path, checksum }) => ({
            module: path,
            checksum,
          })),
        }
      : {}),
  };
  const candidate: ReleaseDescriptor = {
    ...descriptor,
    sourceClosure,
    releaseContent,
    fingerprint: {
      ...descriptor.fingerprint,
      sourceClosure: sourceClosure.checksum,
      authorityChecksum,
      dependencyManifest: sha256(canonicalJson(dependencyArtifacts)),
      ...(graph ? { graphHash: checksumFor(graph.path) } : {}),
      ...(interpreter ? { interpreter: checksumFor(interpreter.path) } : {}),
      releaseChecksum: "pending",
    },
  };
  return {
    ...candidate,
    fingerprint: {
      ...candidate.fingerprint,
      releaseChecksum: checksumReleaseDescriptor(candidate),
    },
  };
};

const assertAuthoritativeFingerprint = (
  cwd: string,
  descriptor: ReleaseDescriptor,
  sourceClosure: SourceClosure,
  overlay: ReadonlyMap<string, string> = new Map(),
): void => {
  if (descriptor.fingerprint.sourceClosure !== sourceClosure.checksum) {
    throw new Error(
      "Publication source-closure fingerprint is not authoritative",
    );
  }
  const expectedAuthorityChecksum = sha256(
    canonicalJson({
      schemaVersion: 1,
      kind: descriptor.kind,
      logicalId: descriptor.logicalId,
      version: descriptor.version,
      sourceClosure,
    }),
  );
  if (descriptor.fingerprint.authorityChecksum !== expectedAuthorityChecksum) {
    throw new Error(
      "Publication authority fingerprint does not match resolved repository bytes",
    );
  }
  if (
    descriptor.releaseContent.authorityChecksum !== expectedAuthorityChecksum ||
    descriptor.releaseContent.sourceClosureChecksum !== sourceClosure.checksum
  ) {
    throw new Error(
      "Publication release content does not use the authoritative source closure",
    );
  }
  const artifacts = descriptor.artifacts.map((artifact) => ({
    ...artifact,
    checksum: sha256(
      overlay.get(resolve(cwd, artifact.path)) ??
        readFileSync(resolve(cwd, artifact.path)),
    ),
  }));
  for (const artifact of artifacts) {
    if (
      artifact.class !== "registry" &&
      !sourceClosure.modules.some(({ path }) => path === artifact.path)
    ) {
      throw new Error(
        `Publication source closure omits ${artifact.class} artifact: ${artifact.path}`,
      );
    }
  }
  const graph = artifacts.find(
    ({ class: artifactClass }) => artifactClass === "graph",
  );
  if (graph && descriptor.fingerprint.graphHash !== graph.checksum) {
    throw new Error(
      "Publication graph fingerprint does not match repository bytes",
    );
  }
  if (graph && descriptor.releaseContent.graphHash !== graph.checksum) {
    throw new Error(
      "Publication release graph does not match repository bytes",
    );
  }
  const interpreter = artifacts.find(
    ({ class: artifactClass }) => artifactClass === "interpreter",
  );
  if (
    interpreter &&
    descriptor.fingerprint.interpreter !== interpreter.checksum
  ) {
    throw new Error(
      "Publication interpreter fingerprint does not match repository bytes",
    );
  }
  if (
    interpreter &&
    (typeof descriptor.releaseContent.interpreter !== "object" ||
      descriptor.releaseContent.interpreter === null ||
      !("checksum" in descriptor.releaseContent.interpreter) ||
      descriptor.releaseContent.interpreter.checksum !== interpreter.checksum)
  ) {
    throw new Error(
      "Publication release interpreter does not match repository bytes",
    );
  }
  const dependencyArtifacts = artifacts
    .filter(({ class: artifactClass }) => artifactClass === "dependency")
    .map(({ path, checksum }) => ({ path, checksum }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const dependencyChecksum = sha256(canonicalJson(dependencyArtifacts));
  if (descriptor.fingerprint.dependencyManifest !== dependencyChecksum) {
    throw new Error(
      "Publication dependency fingerprint does not match repository bytes",
    );
  }
  if (
    descriptor.fingerprint.releaseChecksum !==
    checksumReleaseDescriptor(descriptor)
  ) {
    throw new Error(
      "Publication release checksum does not match authoritative descriptor",
    );
  }
};

export const publishRelease = (input: {
  readonly cwd: string;
  readonly kind: ReleaseKind;
  readonly name: string;
  readonly version: string | undefined;
}) => {
  const version = positiveVersion(input.version, "--version");
  const path = descriptorPath(input.kind, input.name, version);
  const descriptor = readJson<ReleaseDescriptor>(input.cwd, path);
  if (descriptor.lifecycle !== "draft") throw new Error("Release is not draft");
  if (!descriptor.semanticComplete)
    throw new Error("Semantic contract is incomplete");
  if (!descriptor.isolatedFixture) {
    throw new Error("Phase 1 publishes isolated fixtures only");
  }
  for (const field of requiredFingerprintFields(input.kind)) {
    if (!descriptor.fingerprint[field]) {
      throw new Error(`Publication fingerprint is incomplete: ${field}`);
    }
  }
  const sourceClosure = assertAuthoritativeSourceClosure(
    input.cwd,
    descriptor.sourceClosure,
  );
  assertAuthoritativeFingerprint(input.cwd, descriptor, sourceClosure);
  const absoluteManifest = resolve(input.cwd, manifestPath);
  const manifest = existsSync(absoluteManifest)
    ? readJson<PublicationManifest>(input.cwd, manifestPath)
    : { schemaVersion: 1 as const, entries: [], manifestChecksum: "" };
  const unsignedManifest = {
    schemaVersion: manifest.schemaVersion,
    entries: manifest.entries,
  };
  if (
    manifest.entries.length > 0 &&
    checksumManifest(unsignedManifest) !== manifest.manifestChecksum
  ) {
    throw new Error("Current publication manifest checksum is invalid");
  }
  for (const dependency of descriptor.dependencies) {
    const published = manifest.entries.find(
      (entry) =>
        entry.kind === dependency.kind &&
        entry.logicalId === dependency.logicalId &&
        entry.version === dependency.version &&
        entry.lifecycle === "published" &&
        entry.fingerprint.releaseChecksum === dependency.releaseChecksum,
    );
    if (!published)
      throw new Error("Publication dependency is draft or incomplete");
  }
  if (
    manifest.entries.some(
      (entry) =>
        entry.kind === descriptor.kind &&
        entry.logicalId === descriptor.logicalId &&
        entry.version === descriptor.version,
    )
  ) {
    throw new Error("Published release is immutable and cannot be overwritten");
  }
  const release = releasePath(input.kind, input.name, version);
  const publishedReleaseSource = readFileSync(
    resolve(input.cwd, release),
    "utf8",
  ).replace('lifecycle: "draft"', 'lifecycle: "published"');
  const artifacts = descriptor.artifacts.map((artifact) => {
    const content =
      artifact.path === release
        ? publishedReleaseSource
        : readFileSync(resolve(input.cwd, artifact.path));
    return { ...artifact, checksum: sha256(content) };
  });
  const entry: PublicationEntry = {
    kind: descriptor.kind,
    logicalId: descriptor.logicalId,
    version: descriptor.version,
    lifecycle: "published",
    isolatedFixture: descriptor.isolatedFixture,
    fingerprint: descriptor.fingerprint,
    sourceClosure,
    artifacts,
  };
  const unsigned = {
    schemaVersion: 1 as const,
    entries: [...manifest.entries, entry],
  };
  const nextManifest: PublicationManifest = {
    ...unsigned,
    manifestChecksum: checksumManifest(unsigned),
  };
  write(input.cwd, release, publishedReleaseSource);
  write(
    input.cwd,
    path,
    `${JSON.stringify({ ...descriptor, lifecycle: "published" }, null, 2)}\n`,
  );
  write(input.cwd, manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
  return { entry, manifestChecksum: nextManifest.manifestChecksum };
};
