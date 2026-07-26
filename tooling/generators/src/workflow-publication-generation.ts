import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { format } from "prettier";

import { buildWorkflowFiles } from "./workflow-files";
import {
  buildAuthoritativeSourceClosure,
  descriptorWithAuthoritativeSource,
  type ReleaseDescriptor,
} from "./workflow-release-commands";

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
): Promise<WorkflowPublicationGenerationResult> => {
  const currentCapability = readJson<ReleaseDescriptor>(
    cwd,
    capabilityDescriptorPath,
  );
  const currentWorkflow = readJson<ReleaseDescriptor>(
    cwd,
    workflowDescriptorPath,
  );
  if (
    currentCapability.lifecycle === "published" &&
    currentWorkflow.lifecycle === "published"
  ) {
    return {
      files: immutablePublishedPaths.map((path) => ({
        path,
        content: readFileSync(resolve(cwd, path), "utf8"),
      })),
      drift: [],
      publicationCount: 2,
    };
  }
  const capability = refreshDescriptor(cwd, currentCapability);
  const workflow = refreshDescriptor(
    cwd,
    updateWorkflowDependency(currentWorkflow, capability),
  );

  const generated = new Map<string, string>();
  const capabilityRelease = await format(
    replaceKnownValues(
      readFileSync(resolve(cwd, capabilityReleasePath), "utf8"),
      currentCapability,
      capability,
    ),
    { filepath: capabilityReleasePath },
  );
  generated.set(capabilityReleasePath, capabilityRelease);
  generated.set(capabilityAuthorityPath, await renderAuthority(capability));
  generated.set(capabilityDescriptorPath, jsonFile(capability));

  const workflowRelease = await format(
    withRunnerFunctionReference(
      replaceKnownValues(
        readFileSync(resolve(cwd, workflowReleasePath), "utf8"),
        currentWorkflow,
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
): Promise<WorkflowPublicationGenerationResult> => {
  const result = await buildWorkflowPublicationStack(cwd);
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
  const result = await regenerateWorkflowPublicationStack(process.cwd(), write);
  process.stdout.write(
    `${JSON.stringify(
      {
        publicationCount: result.publicationCount,
        generatedFileCount: result.files.length,
        driftCount: result.drift.length,
        drift: result.drift,
        wrote: write,
      },
      null,
      2,
    )}\n`,
  );
  if (!write && result.drift.length > 0) process.exitCode = 1;
}
