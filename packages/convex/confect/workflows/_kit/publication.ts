import { getFunctionName } from "convex/server";

import { sha256Hex } from "../../shared/sha256";

export type PublicationLifecycle = "draft" | "published" | "retired";

export type ChecksummedModule = {
  readonly module: string;
  readonly checksum: string;
};

export type GeneratedPublicationAuthority = {
  readonly schemaVersion: 1;
  readonly descriptorChecksum: string;
  readonly sourceClosure: {
    readonly roots: readonly string[];
    readonly modules: readonly {
      readonly path: string;
      readonly checksum: string;
    }[];
    readonly checksum: string;
  };
};

export type CapabilityRelease<Ref = unknown> = {
  readonly logicalKey: string;
  readonly version: number;
  readonly lifecycle: PublicationLifecycle;
  readonly authority: GeneratedPublicationAuthority;
  readonly functionRef: Ref;
  readonly functionReference: string;
  readonly argsSchema: string;
  readonly returnSchema: string;
  readonly effectManifest: {
    readonly kind: "query" | "mutation" | "action";
    readonly external: boolean;
  };
  readonly dependencyManifest: readonly ChecksummedModule[];
  readonly sourceClosureChecksum: string;
  readonly releaseChecksum: string;
  readonly semanticComplete: boolean;
  readonly isolatedFixture: boolean;
};

export type WorkflowSubworkflowRuntimeBinding = {
  readonly graphJson: string;
  readonly graphSnapshotHash: string;
  readonly argumentMapper: {
    readonly module: string;
    readonly exportName: string;
    readonly schemaName: string;
    readonly mapArgs: unknown;
  };
  readonly resultSchema: {
    readonly module: string;
    readonly exportName: string;
    readonly schemaName: string;
    readonly schema: unknown;
  };
};

export type WorkflowRelease<RunnerRef = unknown, CompletionRef = unknown> = {
  readonly workflowId: string;
  readonly version: number;
  readonly lifecycle: PublicationLifecycle;
  readonly authority: GeneratedPublicationAuthority;
  readonly graphModule: string;
  readonly graphHash: string;
  readonly subworkflowRuntime?: WorkflowSubworkflowRuntimeBinding;
  readonly runner: {
    readonly ref: RunnerRef;
    readonly module: string;
    readonly functionReference: string;
  };
  readonly events: readonly {
    readonly definition: string;
    readonly validator: string;
  }[];
  readonly completion: {
    readonly ref: CompletionRef;
    readonly module: string;
    readonly version: number;
  };
  readonly kickoffProfiles: readonly ("eager-first-poll" | "queued")[];
  readonly capabilityBindings: readonly {
    readonly logicalKey: string;
    readonly version: number;
    readonly releaseChecksum: string;
  }[];
  readonly subworkflowBindings: readonly {
    readonly workflowId: string;
    readonly version: number;
    readonly releaseChecksum: string;
  }[];
  readonly runtimeVersion: string;
  readonly interpreter: ChecksummedModule;
  readonly lifecycleContractVersion: number;
  readonly sourceClosureChecksum: string;
  readonly releaseChecksum: string;
  readonly stableStepNames: readonly string[];
  readonly semanticComplete: boolean;
  readonly isolatedFixture: boolean;
};

export type PublicationRegistry = {
  readonly capabilities: readonly CapabilityRelease[];
  readonly workflows: readonly WorkflowRelease[];
};

const releaseKey = (name: string, version: number) => `${name}@v${version}`;
const sha256Pattern = /^[a-f0-9]{64}$/;

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

const deepFreeze = <Value>(value: Value): Value => {
  if (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    !Object.isFrozen(value)
  ) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const assertText = (value: string, label: string): void => {
  if (value.length === 0) throw new Error(`${label} must not be empty`);
};

const assertVersion = (version: number, label: string): void => {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error(`${label} version must be a positive safe integer`);
  }
};

const assertChecksum = (checksum: string, label: string): void => {
  if (!sha256Pattern.test(checksum)) {
    throw new Error(`${label} must be a lowercase SHA-256 checksum`);
  }
};

const cloneAndValidateModules = (
  modules: readonly ChecksummedModule[],
  label: string,
): readonly ChecksummedModule[] => {
  const seen = new Set<string>();
  const validated = modules.map((entry) => {
    assertText(entry.module, `${label} module`);
    if (seen.has(entry.module)) {
      throw new Error(`Duplicate ${label} module: ${entry.module}`);
    }
    seen.add(entry.module);
    assertChecksum(entry.checksum, entry.module);
    return { ...entry };
  });
  return validated.sort((left, right) =>
    left.module.localeCompare(right.module),
  );
};

const checksumCapabilityRelease = (release: CapabilityRelease): string =>
  sha256Hex(
    canonicalJson({
      logicalKey: release.logicalKey,
      version: release.version,
      authorityChecksum: release.authority.descriptorChecksum,
      functionReference: release.functionReference,
      argsSchema: release.argsSchema,
      returnSchema: release.returnSchema,
      effectManifest: release.effectManifest,
      dependencyManifest: release.dependencyManifest.map(
        ({ module, checksum }) => ({ module, checksum }),
      ),
      sourceClosureChecksum: release.sourceClosureChecksum,
      semanticComplete: release.semanticComplete,
      isolatedFixture: release.isolatedFixture,
    }),
  );

const checksumWorkflowRelease = (release: WorkflowRelease): string =>
  sha256Hex(
    canonicalJson({
      workflowId: release.workflowId,
      version: release.version,
      authorityChecksum: release.authority.descriptorChecksum,
      graphModule: release.graphModule,
      graphHash: release.graphHash,
      ...(release.subworkflowRuntime
        ? {
            subworkflowRuntime: {
              graphSnapshotHash: release.subworkflowRuntime.graphSnapshotHash,
              argumentMapper: {
                module: release.subworkflowRuntime.argumentMapper.module,
                exportName:
                  release.subworkflowRuntime.argumentMapper.exportName,
                schemaName:
                  release.subworkflowRuntime.argumentMapper.schemaName,
              },
              resultSchema: {
                module: release.subworkflowRuntime.resultSchema.module,
                exportName: release.subworkflowRuntime.resultSchema.exportName,
                schemaName: release.subworkflowRuntime.resultSchema.schemaName,
              },
            },
          }
        : {}),
      runnerModule: release.runner.module,
      runnerFunctionReference: release.runner.functionReference,
      events: release.events,
      completionModule: release.completion.module,
      completionVersion: release.completion.version,
      kickoffProfiles: release.kickoffProfiles,
      capabilityBindings: release.capabilityBindings,
      subworkflowBindings: release.subworkflowBindings,
      runtimeVersion: release.runtimeVersion,
      interpreter: {
        module: release.interpreter.module,
        checksum: release.interpreter.checksum,
      },
      lifecycleContractVersion: release.lifecycleContractVersion,
      sourceClosureChecksum: release.sourceClosureChecksum,
      stableStepNames: release.stableStepNames,
      semanticComplete: release.semanticComplete,
      isolatedFixture: release.isolatedFixture,
    }),
  );

const checksumSourceClosureDescriptor = (
  sourceClosure: Pick<
    GeneratedPublicationAuthority["sourceClosure"],
    "roots" | "modules"
  >,
): string =>
  sha256Hex(
    canonicalJson({
      roots: sourceClosure.roots,
      modules: sourceClosure.modules,
    }),
  );

const checksumAuthorityDescriptor = (
  kind: "workflow" | "capability",
  logicalId: string,
  version: number,
  sourceClosure: GeneratedPublicationAuthority["sourceClosure"],
): string =>
  sha256Hex(
    canonicalJson({
      schemaVersion: 1,
      kind,
      logicalId,
      version,
      sourceClosure,
    }),
  );

const assertUniqueKeys = (values: readonly string[], label: string): void => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
};

const cloneAndValidateAuthority = (
  authority: GeneratedPublicationAuthority,
  kind: "workflow" | "capability",
  logicalId: string,
  version: number,
): GeneratedPublicationAuthority => {
  const sourceClosure = {
    roots: [...authority.sourceClosure.roots].sort(),
    modules: authority.sourceClosure.modules
      .map((module) => ({ ...module }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    checksum: authority.sourceClosure.checksum,
  };
  assertUniqueKeys(
    sourceClosure.modules.map(({ path }) => path),
    "publication source module",
  );
  for (const module of sourceClosure.modules) {
    assertText(module.path, "publication source module path");
    assertChecksum(module.checksum, module.path);
  }
  if (
    sourceClosure.checksum !== checksumSourceClosureDescriptor(sourceClosure)
  ) {
    throw new Error(
      "Generated source closure checksum does not match its descriptor",
    );
  }
  if (
    authority.descriptorChecksum !==
    checksumAuthorityDescriptor(kind, logicalId, version, sourceClosure)
  ) {
    throw new Error(
      "Generated publication authority checksum does not match its descriptor",
    );
  }
  return {
    schemaVersion: 1,
    descriptorChecksum: authority.descriptorChecksum,
    sourceClosure,
  };
};

/** Test-fixture hashing only. Production descriptors are emitted by Node tooling. */
export const publicationTestOnly = {
  checksumCapabilityRelease,
  checksumWorkflowRelease,
  checksumSourceClosureDescriptor,
  checksumAuthorityDescriptor,
} as const;

export const defineCapabilityRelease = <Ref>(
  release: CapabilityRelease<Ref>,
): CapabilityRelease<Ref> => {
  assertVersion(release.version, release.logicalKey);
  assertText(release.logicalKey, "capability logical key");
  assertText(release.functionReference, "capability function reference");
  const dependencyManifest = cloneAndValidateModules(
    release.dependencyManifest,
    "capability dependency",
  );
  const authority = cloneAndValidateAuthority(
    release.authority,
    "capability",
    release.logicalKey,
    release.version,
  );
  for (const dependency of dependencyManifest) {
    if (
      !authority.sourceClosure.modules.some(
        ({ path, checksum }) =>
          path === dependency.module && checksum === dependency.checksum,
      )
    ) {
      throw new Error(
        `Capability dependency is absent from authoritative closure: ${dependency.module}`,
      );
    }
  }
  const candidate: CapabilityRelease<Ref> = {
    ...release,
    authority,
    effectManifest: { ...release.effectManifest },
    dependencyManifest,
  };
  if (release.sourceClosureChecksum !== authority.sourceClosure.checksum) {
    throw new Error("Capability source closure is not authoritative");
  }
  if (release.releaseChecksum !== checksumCapabilityRelease(candidate)) {
    throw new Error(
      "Capability release checksum does not match generated descriptor",
    );
  }
  return deepFreeze(candidate);
};

export const defineWorkflowRelease = <RunnerRef, CompletionRef>(
  release: WorkflowRelease<RunnerRef, CompletionRef>,
): WorkflowRelease<RunnerRef, CompletionRef> => {
  assertVersion(release.version, release.workflowId);
  assertVersion(release.completion.version, "completion");
  assertVersion(release.lifecycleContractVersion, "lifecycle contract");
  assertText(release.workflowId, "workflow id");
  assertText(release.graphModule, "workflow graph module");
  assertChecksum(release.graphHash, "workflow graph");
  const authority = cloneAndValidateAuthority(
    release.authority,
    "workflow",
    release.workflowId,
    release.version,
  );
  if (
    !authority.sourceClosure.modules.some(
      ({ path, checksum }) =>
        path === release.graphModule && checksum === release.graphHash,
    )
  ) {
    throw new Error("Workflow graph is absent from authoritative closure");
  }
  validateRunnerBinding(release, authority);
  const subworkflowRuntime = validateSubworkflowRuntimeBinding(
    release,
    authority,
  );
  const [interpreter] = cloneAndValidateModules(
    [release.interpreter],
    "workflow interpreter",
  );
  if (!interpreter) throw new Error("Workflow interpreter is required");
  const closureInterpreter = authority.sourceClosure.modules.find(
    ({ path }) => path === interpreter.module,
  );
  if (closureInterpreter?.checksum !== interpreter.checksum) {
    throw new Error(
      "Workflow source closure must contain the exact interpreter source",
    );
  }
  if (release.sourceClosureChecksum !== authority.sourceClosure.checksum) {
    throw new Error("Workflow source closure is not authoritative");
  }
  assertUniqueKeys(
    release.capabilityBindings.map(({ logicalKey }) => logicalKey),
    "workflow capability binding",
  );
  assertUniqueKeys(
    release.subworkflowBindings.map(({ workflowId }) => workflowId),
    "workflow subworkflow binding",
  );
  assertUniqueKeys(release.stableStepNames, "workflow stable step name");
  const candidate: WorkflowRelease<RunnerRef, CompletionRef> = {
    ...release,
    authority,
    ...(subworkflowRuntime ? { subworkflowRuntime } : {}),
    runner: { ...release.runner },
    events: release.events.map((event) => ({ ...event })),
    completion: { ...release.completion },
    kickoffProfiles: [...release.kickoffProfiles],
    capabilityBindings: release.capabilityBindings.map((binding) => ({
      ...binding,
    })),
    subworkflowBindings: release.subworkflowBindings.map((binding) => ({
      ...binding,
    })),
    interpreter,
    stableStepNames: [...release.stableStepNames],
  };
  if (release.releaseChecksum !== checksumWorkflowRelease(candidate)) {
    throw new Error(
      "Workflow release checksum does not match generated descriptor",
    );
  }
  return deepFreeze(candidate);
};

const validateRunnerBinding = (
  release: WorkflowRelease,
  authority: GeneratedPublicationAuthority,
): void => {
  assertText(
    release.runner.functionReference,
    "workflow runner stable generated identity",
  );
  let actualFunctionReference: string;
  try {
    actualFunctionReference = getFunctionName(
      release.runner.ref as Parameters<typeof getFunctionName>[0],
    );
  } catch {
    throw new Error(
      "Workflow runner reference does not match its stable generated identity",
    );
  }
  if (
    actualFunctionReference !== release.runner.functionReference ||
    release.runner.module !== release.runner.functionReference
  ) {
    throw new Error(
      "Workflow runner reference does not match its stable generated identity",
    );
  }
  const modulePath = release.runner.functionReference.split(":")[0];
  if (
    !modulePath ||
    !authority.sourceClosure.modules.some(
      ({ path }) => path === `packages/convex/convex/${modulePath}.ts`,
    )
  ) {
    throw new Error(
      "Workflow runner module and reference are absent from the immutable source closure",
    );
  }
};

const validateSubworkflowRuntimeBinding = (
  release: WorkflowRelease,
  authority: GeneratedPublicationAuthority,
): WorkflowSubworkflowRuntimeBinding | undefined => {
  const binding = release.subworkflowRuntime;
  if (binding === undefined) return undefined;
  if (
    binding.graphJson.length === 0 ||
    binding.graphJson.length > 256 << 10 ||
    !sha256Pattern.test(binding.graphSnapshotHash) ||
    sha256Hex(binding.graphJson) !== binding.graphSnapshotHash ||
    binding.argumentMapper.module.length === 0 ||
    binding.argumentMapper.exportName.length === 0 ||
    binding.argumentMapper.schemaName.length === 0 ||
    typeof binding.argumentMapper.mapArgs !== "function" ||
    binding.resultSchema.module.length === 0 ||
    binding.resultSchema.exportName.length === 0 ||
    binding.resultSchema.schemaName.length === 0 ||
    binding.resultSchema.schema === undefined
  ) {
    throw new Error("Workflow subworkflow runtime binding is invalid");
  }
  let graph: unknown;
  try {
    graph = JSON.parse(binding.graphJson);
  } catch {
    graph = null;
  }
  if (
    graph === null ||
    typeof graph !== "object" ||
    !("id" in graph) ||
    graph.id !== release.workflowId ||
    !("version" in graph) ||
    graph.version !== release.version ||
    !("argsSchemaName" in graph) ||
    graph.argsSchemaName !== binding.argumentMapper.schemaName ||
    !("returnSchemaName" in graph) ||
    graph.returnSchemaName !== binding.resultSchema.schemaName ||
    !authority.sourceClosure.modules.some(
      ({ path }) => path === binding.argumentMapper.module,
    ) ||
    !authority.sourceClosure.modules.some(
      ({ path }) => path === binding.resultSchema.module,
    )
  ) {
    throw new Error(
      "Workflow subworkflow runtime binding is absent from the immutable source closure",
    );
  }
  return Object.freeze({
    graphJson: binding.graphJson,
    graphSnapshotHash: binding.graphSnapshotHash,
    argumentMapper: Object.freeze({ ...binding.argumentMapper }),
    resultSchema: Object.freeze({ ...binding.resultSchema }),
  });
};

const assertUnique = <Release>(
  releases: readonly Release[],
  keyOf: (release: Release) => string,
  label: string,
): void => {
  const keys = new Set<string>();
  for (const release of releases) {
    const key = keyOf(release);
    if (keys.has(key)) throw new Error(`Duplicate ${label} release: ${key}`);
    keys.add(key);
  }
};

export const definePublicationRegistry = (
  registry: PublicationRegistry,
): PublicationRegistry => {
  const capabilities = registry.capabilities.map((release) =>
    defineCapabilityRelease(release),
  );
  const workflows = registry.workflows.map((release) =>
    defineWorkflowRelease(release),
  );
  assertUnique(
    capabilities,
    (release) => releaseKey(release.logicalKey, release.version),
    "capability",
  );
  assertUnique(
    workflows,
    (release) => releaseKey(release.workflowId, release.version),
    "workflow",
  );
  return deepFreeze({ capabilities, workflows });
};

const capabilityAt = (
  registry: PublicationRegistry,
  logicalKey: string,
  version: number,
): CapabilityRelease => {
  const release = registry.capabilities.find(
    (candidate) =>
      candidate.logicalKey === logicalKey && candidate.version === version,
  );
  if (!release) {
    throw new Error(
      `Capability release not found: ${releaseKey(logicalKey, version)}`,
    );
  }
  return defineCapabilityRelease(release);
};

const workflowAt = (
  registry: PublicationRegistry,
  workflowId: string,
  version: number,
): WorkflowRelease => {
  const release = registry.workflows.find(
    (candidate) =>
      candidate.workflowId === workflowId && candidate.version === version,
  );
  if (!release) {
    throw new Error(
      `Workflow release not found: ${releaseKey(workflowId, version)}`,
    );
  }
  return defineWorkflowRelease(release);
};

const replaceCapability = (
  registry: PublicationRegistry,
  release: CapabilityRelease,
): PublicationRegistry => {
  const validated = defineCapabilityRelease(release);
  return definePublicationRegistry({
    ...registry,
    capabilities: registry.capabilities.map((candidate) =>
      candidate.logicalKey === validated.logicalKey &&
      candidate.version === validated.version
        ? validated
        : candidate,
    ),
  });
};

const replaceWorkflow = (
  registry: PublicationRegistry,
  release: WorkflowRelease,
): PublicationRegistry => {
  const validated = defineWorkflowRelease(release);
  return definePublicationRegistry({
    ...registry,
    workflows: registry.workflows.map((candidate) =>
      candidate.workflowId === validated.workflowId &&
      candidate.version === validated.version
        ? validated
        : candidate,
    ),
  });
};

export const addCapabilityRelease = (
  registry: PublicationRegistry,
  release: CapabilityRelease,
): PublicationRegistry => {
  const validated = defineCapabilityRelease(release);
  const existing = registry.capabilities.find(
    (candidate) =>
      candidate.logicalKey === validated.logicalKey &&
      candidate.version === validated.version,
  );
  if (
    existing?.lifecycle === "published" ||
    existing?.lifecycle === "retired"
  ) {
    throw new Error(
      `Capability release is immutable: ${releaseKey(validated.logicalKey, validated.version)}`,
    );
  }
  return existing
    ? replaceCapability(registry, validated)
    : definePublicationRegistry({
        ...registry,
        capabilities: [...registry.capabilities, validated],
      });
};

export const addWorkflowRelease = (
  registry: PublicationRegistry,
  release: WorkflowRelease,
): PublicationRegistry => {
  const validated = defineWorkflowRelease(release);
  const existing = registry.workflows.find(
    (candidate) =>
      candidate.workflowId === validated.workflowId &&
      candidate.version === validated.version,
  );
  if (
    existing?.lifecycle === "published" ||
    existing?.lifecycle === "retired"
  ) {
    throw new Error(
      `Workflow release is immutable: ${releaseKey(validated.workflowId, validated.version)}`,
    );
  }
  return existing
    ? replaceWorkflow(registry, validated)
    : definePublicationRegistry({
        ...registry,
        workflows: [...registry.workflows, validated],
      });
};

export const publishCapability = (
  registry: PublicationRegistry,
  logicalKey: string,
  version: number,
): PublicationRegistry => {
  const release = capabilityAt(registry, logicalKey, version);
  if (release.lifecycle !== "draft") throw new Error("Capability is not draft");
  if (!release.semanticComplete)
    throw new Error("Capability semantic contract is incomplete");
  if (!release.isolatedFixture)
    throw new Error("Phase 1 publishes isolated fixtures only");
  return replaceCapability(registry, { ...release, lifecycle: "published" });
};

const assertPublishedDependencies = (
  registry: PublicationRegistry,
  release: WorkflowRelease,
): void => {
  for (const binding of release.capabilityBindings) {
    const dependency = capabilityAt(
      registry,
      binding.logicalKey,
      binding.version,
    );
    if (dependency.lifecycle !== "published") {
      throw new Error(
        `Capability dependency is ${dependency.lifecycle}: ${releaseKey(binding.logicalKey, binding.version)}`,
      );
    }
    if (dependency.releaseChecksum !== binding.releaseChecksum) {
      throw new Error(
        `Capability dependency checksum drift: ${releaseKey(binding.logicalKey, binding.version)}`,
      );
    }
  }
  for (const binding of release.subworkflowBindings) {
    const dependency = workflowAt(
      registry,
      binding.workflowId,
      binding.version,
    );
    if (dependency.lifecycle !== "published") {
      throw new Error(
        `Subworkflow dependency is ${dependency.lifecycle}: ${releaseKey(binding.workflowId, binding.version)}`,
      );
    }
    if (dependency.releaseChecksum !== binding.releaseChecksum) {
      throw new Error(
        `Subworkflow dependency checksum drift: ${releaseKey(binding.workflowId, binding.version)}`,
      );
    }
  }
};

export const publishWorkflow = (
  registry: PublicationRegistry,
  workflowId: string,
  version: number,
): PublicationRegistry => {
  const release = workflowAt(registry, workflowId, version);
  if (release.lifecycle !== "draft") throw new Error("Workflow is not draft");
  if (!release.semanticComplete)
    throw new Error("Workflow semantic contract is incomplete");
  if (!release.isolatedFixture)
    throw new Error("Phase 1 publishes isolated fixtures only");
  if (
    new Set(release.stableStepNames).size !== release.stableStepNames.length
  ) {
    throw new Error("Workflow stable step names must be unique");
  }
  assertPublishedDependencies(registry, release);
  return replaceWorkflow(registry, { ...release, lifecycle: "published" });
};

export const retireWorkflow = (
  registry: PublicationRegistry,
  workflowId: string,
  version: number,
): PublicationRegistry => {
  const release = workflowAt(registry, workflowId, version);
  if (release.lifecycle !== "published")
    throw new Error("Only published workflows can retire");
  return replaceWorkflow(registry, { ...release, lifecycle: "retired" });
};

export const resolveWorkflowForRun = workflowAt;

export const resolveWorkflowCapabilityForRun = (
  registry: PublicationRegistry,
  workflow: WorkflowRelease,
  logicalKey: string,
): CapabilityRelease => {
  const binding = workflow.capabilityBindings.find(
    (candidate) => candidate.logicalKey === logicalKey,
  );
  if (!binding)
    throw new Error(`Workflow capability binding not found: ${logicalKey}`);
  const release = capabilityAt(registry, binding.logicalKey, binding.version);
  if (release.lifecycle === "draft")
    throw new Error("Active run cannot resolve a draft capability");
  if (release.releaseChecksum !== binding.releaseChecksum) {
    throw new Error(`Workflow capability binding drift: ${logicalKey}`);
  }
  return release;
};

export const resolveWorkflowStart = (
  registry: PublicationRegistry,
  workflowId: string,
  version: number,
): WorkflowRelease => {
  const release = workflowAt(registry, workflowId, version);
  if (release.lifecycle !== "published") {
    throw new Error(`Workflow ${release.lifecycle} release rejects new starts`);
  }
  assertPublishedDependencies(registry, release);
  return release;
};

export type WorkflowStartPublicationBinding = {
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly graphHash: string;
  readonly runnerRef: unknown;
  readonly runnerModule: string;
  readonly runnerFunctionReference: string;
  readonly releaseChecksum: string;
  readonly kickoffProfile: "eager-first-poll" | "queued";
};

export const assertWorkflowStartBinding = (
  registry: PublicationRegistry,
  binding: WorkflowStartPublicationBinding,
): WorkflowRelease => {
  const release = resolveWorkflowStart(
    registry,
    binding.workflowId,
    binding.workflowVersion,
  );
  if (release.graphHash !== binding.graphHash) {
    throw new Error(
      "Published workflow graph hash does not match start binding",
    );
  }
  if (
    release.runner.ref !== binding.runnerRef ||
    release.runner.module !== binding.runnerModule ||
    release.runner.functionReference !== binding.runnerFunctionReference
  ) {
    throw new Error("Published workflow runner does not match start binding");
  }
  if (release.releaseChecksum !== binding.releaseChecksum) {
    throw new Error("Published workflow checksum does not match start binding");
  }
  if (!release.kickoffProfiles.includes(binding.kickoffProfile)) {
    throw new Error("Published workflow kickoff profile is unavailable");
  }
  return release;
};
