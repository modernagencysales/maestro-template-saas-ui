import { sha256Hex } from "../../shared/sha256";

export type PublicationLifecycle = "draft" | "published" | "retired";

export type ChecksummedModule = {
  readonly module: string;
  readonly source: string;
  readonly checksum: string;
};

export type CapabilityRelease<Ref = unknown> = {
  readonly logicalKey: string;
  readonly version: number;
  readonly lifecycle: PublicationLifecycle;
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

export type WorkflowRelease<RunnerRef = unknown, CompletionRef = unknown> = {
  readonly workflowId: string;
  readonly version: number;
  readonly lifecycle: PublicationLifecycle;
  readonly graphSource: string;
  readonly graphHash: string;
  readonly runner: { readonly ref: RunnerRef; readonly module: string };
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
  readonly sourceManifest: readonly ChecksummedModule[];
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

const assertChecksum = (
  claimed: string,
  actual: string,
  label: string,
): void => {
  if (claimed !== actual) {
    throw new Error(`${label} checksum does not match canonical content`);
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
    assertChecksum(entry.checksum, sha256Hex(entry.source), entry.module);
    return { ...entry };
  });
  return validated.sort((left, right) =>
    left.module.localeCompare(right.module),
  );
};

export const checksumPublicationSource = (source: string): string =>
  sha256Hex(source);

export const checksumPublicationSourceClosure = (
  modules: readonly ChecksummedModule[],
): string =>
  sha256Hex(
    canonicalJson({
      modules: modules
        .map(({ module, source }) => ({
          module,
          checksum: sha256Hex(source),
        }))
        .sort((left, right) => left.module.localeCompare(right.module)),
    }),
  );

export const checksumCapabilityRelease = (release: CapabilityRelease): string =>
  sha256Hex(
    canonicalJson({
      logicalKey: release.logicalKey,
      version: release.version,
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

export const checksumWorkflowRelease = (release: WorkflowRelease): string =>
  sha256Hex(
    canonicalJson({
      workflowId: release.workflowId,
      version: release.version,
      graphHash: release.graphHash,
      runnerModule: release.runner.module,
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

const assertUniqueKeys = (values: readonly string[], label: string): void => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
};

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
  const candidate: CapabilityRelease<Ref> = {
    ...release,
    effectManifest: { ...release.effectManifest },
    dependencyManifest,
  };
  assertChecksum(
    release.sourceClosureChecksum,
    checksumPublicationSourceClosure(dependencyManifest),
    "capability source closure",
  );
  assertChecksum(
    release.releaseChecksum,
    checksumCapabilityRelease(candidate),
    "capability release",
  );
  return deepFreeze(candidate);
};

export const defineWorkflowRelease = <RunnerRef, CompletionRef>(
  release: WorkflowRelease<RunnerRef, CompletionRef>,
): WorkflowRelease<RunnerRef, CompletionRef> => {
  assertVersion(release.version, release.workflowId);
  assertVersion(release.completion.version, "completion");
  assertVersion(release.lifecycleContractVersion, "lifecycle contract");
  assertText(release.workflowId, "workflow id");
  assertChecksum(
    release.graphHash,
    sha256Hex(release.graphSource),
    "workflow graph",
  );
  const [interpreter] = cloneAndValidateModules(
    [release.interpreter],
    "workflow interpreter",
  );
  if (!interpreter) throw new Error("Workflow interpreter is required");
  const sourceManifest = cloneAndValidateModules(
    release.sourceManifest,
    "workflow source",
  );
  const closureInterpreter = sourceManifest.find(
    ({ module }) => module === interpreter.module,
  );
  if (closureInterpreter?.checksum !== interpreter.checksum) {
    throw new Error(
      "Workflow source closure must contain the exact interpreter source",
    );
  }
  assertChecksum(
    release.sourceClosureChecksum,
    checksumPublicationSourceClosure(sourceManifest),
    "workflow source closure",
  );
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
    sourceManifest,
    stableStepNames: [...release.stableStepNames],
  };
  assertChecksum(
    release.releaseChecksum,
    checksumWorkflowRelease(candidate),
    "workflow release",
  );
  return deepFreeze(candidate);
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
    release.runner.module !== binding.runnerModule
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
