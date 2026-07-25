export type PublicationLifecycle = "draft" | "published" | "retired";

export type ChecksummedModule = {
  readonly module: string;
  readonly checksum: string;
};

export type CapabilityRelease<Ref = unknown> = {
  readonly logicalKey: string;
  readonly version: number;
  readonly lifecycle: PublicationLifecycle;
  readonly functionRef: Ref;
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
  readonly graphHash: string;
  readonly runner: { readonly ref: RunnerRef; readonly module: string };
  readonly events: readonly {
    readonly definition: string;
    readonly validator: string;
  }[];
  readonly completion: {
    readonly ref: CompletionRef;
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

const sha256Pattern = /^[a-f0-9]{64}$/;

const releaseKey = (name: string, version: number) => `${name}@v${version}`;

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

export const defineCapabilityRelease = <Ref>(
  release: CapabilityRelease<Ref>,
): CapabilityRelease<Ref> => {
  assertVersion(release.version, release.logicalKey);
  assertChecksum(release.sourceClosureChecksum, "capability source closure");
  assertChecksum(release.releaseChecksum, "capability release");
  for (const dependency of release.dependencyManifest) {
    assertChecksum(dependency.checksum, dependency.module);
  }
  return Object.freeze(release);
};

export const defineWorkflowRelease = <RunnerRef, CompletionRef>(
  release: WorkflowRelease<RunnerRef, CompletionRef>,
): WorkflowRelease<RunnerRef, CompletionRef> => {
  assertVersion(release.version, release.workflowId);
  assertVersion(release.completion.version, "completion");
  assertVersion(release.lifecycleContractVersion, "lifecycle contract");
  assertChecksum(release.graphHash, "workflow graph");
  assertChecksum(release.interpreter.checksum, "workflow interpreter");
  assertChecksum(release.sourceClosureChecksum, "workflow source closure");
  assertChecksum(release.releaseChecksum, "workflow release");
  return Object.freeze(release);
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
  assertUnique(
    registry.capabilities,
    (release) => releaseKey(release.logicalKey, release.version),
    "capability",
  );
  assertUnique(
    registry.workflows,
    (release) => releaseKey(release.workflowId, release.version),
    "workflow",
  );
  return Object.freeze(registry);
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
  return release;
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
  return release;
};

const replaceCapability = (
  registry: PublicationRegistry,
  release: CapabilityRelease,
): PublicationRegistry =>
  definePublicationRegistry({
    ...registry,
    capabilities: registry.capabilities.map((candidate) =>
      candidate.logicalKey === release.logicalKey &&
      candidate.version === release.version
        ? release
        : candidate,
    ),
  });

const replaceWorkflow = (
  registry: PublicationRegistry,
  release: WorkflowRelease,
): PublicationRegistry =>
  definePublicationRegistry({
    ...registry,
    workflows: registry.workflows.map((candidate) =>
      candidate.workflowId === release.workflowId &&
      candidate.version === release.version
        ? release
        : candidate,
    ),
  });

export const addCapabilityRelease = (
  registry: PublicationRegistry,
  release: CapabilityRelease,
): PublicationRegistry => {
  const existing = registry.capabilities.find(
    (candidate) =>
      candidate.logicalKey === release.logicalKey &&
      candidate.version === release.version,
  );
  if (
    existing?.lifecycle === "published" ||
    existing?.lifecycle === "retired"
  ) {
    throw new Error(
      `Capability release is immutable: ${releaseKey(release.logicalKey, release.version)}`,
    );
  }
  return existing
    ? replaceCapability(registry, release)
    : definePublicationRegistry({
        ...registry,
        capabilities: [...registry.capabilities, release],
      });
};

export const addWorkflowRelease = (
  registry: PublicationRegistry,
  release: WorkflowRelease,
): PublicationRegistry => {
  const existing = registry.workflows.find(
    (candidate) =>
      candidate.workflowId === release.workflowId &&
      candidate.version === release.version,
  );
  if (
    existing?.lifecycle === "published" ||
    existing?.lifecycle === "retired"
  ) {
    throw new Error(
      `Workflow release is immutable: ${releaseKey(release.workflowId, release.version)}`,
    );
  }
  return existing
    ? replaceWorkflow(registry, release)
    : definePublicationRegistry({
        ...registry,
        workflows: [...registry.workflows, release],
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
