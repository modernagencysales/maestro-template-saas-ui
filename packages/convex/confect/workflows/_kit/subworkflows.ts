import type { FunctionReference } from "convex/server";
import { getConvexSize, v } from "convex/values";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
import { sha256Hex } from "../../shared/sha256";
import {
  WorkflowReference,
  type WorkflowNodeV2,
  type WorkflowReference as WorkflowReferenceType,
} from "../graph";
import { assertJsonSafe } from "./graphRunnerJson";
import type { DurableGraphStepRef, RunDurableGraphStep } from "./graphRunner";
import type {
  SubworkflowRunLinkOutcome,
  SubworkflowRunLinkProjection,
} from "./subworkflowLinks";
import {
  MAX_SUBWORKFLOW_RESULT_BYTES,
  subworkflowRunLinkIdempotencyKey,
} from "./subworkflowLinks";
import {
  DurableWorkflowPrincipal,
  hasReservedWorkflowIdentityField,
  type DurableWorkflowPrincipal as WorkflowPrincipalType,
} from "./principal";
import {
  WorkflowPolicySnapshot,
  type WorkflowPolicySnapshot as WorkflowPolicySnapshotType,
} from "./policySnapshot";
import {
  resolveWorkflowStart,
  type PublicationRegistry,
  type WorkflowRelease,
  type WorkflowSubworkflowRuntimeBinding,
} from "./publication";

export { scheduledSubworkflowFinding } from "./workflowValidationFindings";

type SubworkflowNodeV2 = Extract<WorkflowNodeV2, { kind: "subworkflow" }>;
type MappedChildArgs = Readonly<Record<string, unknown>>;
export type SubworkflowExecutionContext = {
  readonly linkId: string;
  readonly parentWorkflowRunId: string;
  readonly parentComponentWorkflowId: string;
  readonly generation: number;
  readonly reservedAt: number;
};
export const SubworkflowExecutionContextValidator = v.object({
  linkId: v.string(),
  parentWorkflowRunId: v.string(),
  parentComponentWorkflowId: v.string(),
  generation: v.number(),
  reservedAt: v.number(),
});
type ChildWorkflowArgs = MappedChildArgs & {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly idempotencyKey: string;
  readonly principal: WorkflowPrincipalType;
  readonly policySnapshot: WorkflowPolicySnapshotType;
  readonly subworkflow?: SubworkflowExecutionContext;
};
export type AnyChildWorkflowArgs = ChildWorkflowArgs;

export type DurableGraphWorkflowRef<
  Args extends ChildWorkflowArgs,
  Result,
> = FunctionReference<"mutation", "internal", { args: Args }, Result>;

export type WorkflowV2SubworkflowEnvelope = {
  readonly inputs: unknown;
  readonly context: Readonly<Record<string, unknown>>;
  readonly principal: WorkflowPrincipalType;
  readonly policySnapshot: unknown;
};

export type WorkflowV2SubworkflowDefinition<
  Args extends ChildWorkflowArgs,
  Result,
> = {
  readonly mapArgs: (
    envelope: WorkflowV2SubworkflowEnvelope,
  ) => Omit<
    Args,
    | "workspaceId"
    | "workflowRunId"
    | "idempotencyKey"
    | "principal"
    | "policySnapshot"
    | "subworkflow"
  >;
  readonly resultSchema: Schema.Codec<Result, unknown>;
  readonly principal:
    | { readonly kind: "inherit" }
    | { readonly kind: "narrow"; readonly grants: readonly string[] };
  readonly publication: {
    readonly workflowId: string;
    readonly argumentMapper: {
      readonly module: string;
      readonly exportName: string;
      readonly schemaName: string;
    };
    readonly resultSchema: {
      readonly module: string;
      readonly exportName: string;
      readonly schemaName: string;
    };
  };
  readonly links: {
    readonly reserveRef: DurableGraphStepRef<"mutation">;
    readonly reconcileRef: DurableGraphStepRef<"mutation">;
    readonly reportReconciliationFailureRef: DurableGraphStepRef<"mutation">;
  };
  readonly artifacts: {
    readonly getOwnedRef: DurableGraphStepRef<"query">;
  };
};

export type WorkflowV2SubworkflowRegistryEntry<
  Args extends ChildWorkflowArgs,
  Result,
> = WorkflowV2SubworkflowDefinition<Args, Result> & {
  readonly version: number;
  readonly ref: DurableGraphWorkflowRef<Args, Result>;
  readonly lifecycle: {
    readonly cancel: "restricted";
    readonly cleanup: "restricted";
    readonly contractVersion: number;
  };
  readonly children: readonly WorkflowReferenceType[];
  readonly publication: {
    readonly workflowId: string;
    readonly graphJson: string;
    readonly argumentMapper: {
      readonly module: string;
      readonly exportName: string;
      readonly schemaName: string;
    };
    readonly resultSchema: {
      readonly module: string;
      readonly exportName: string;
      readonly schemaName: string;
    };
    readonly releaseChecksum: string;
    readonly graphHash: string;
    readonly runnerModule: string;
    readonly runnerFunctionReference: string;
  };
};

export type AnyWorkflowV2SubworkflowRegistryEntry = {
  readonly version: number;
  readonly ref: DurableGraphWorkflowRef<AnyChildWorkflowArgs, unknown>;
  readonly mapArgs: (
    envelope: WorkflowV2SubworkflowEnvelope,
  ) => MappedChildArgs;
  readonly resultSchema: Schema.Codec<unknown, unknown>;
  readonly principal: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["principal"];
  readonly lifecycle: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["lifecycle"];
  readonly children: readonly WorkflowReferenceType[];
  readonly publication: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["publication"];
  readonly links: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["links"];
  readonly artifacts: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["artifacts"];
};

export type WorkflowV2SubworkflowPolicy = {
  readonly maxDepth: number;
  readonly maxFanOut: number;
};

export const defineWorkflowV2Subworkflow = <
  Args extends ChildWorkflowArgs,
  Result,
>(
  entry: WorkflowV2SubworkflowDefinition<Args, Result>,
): WorkflowV2SubworkflowDefinition<Args, Result> => entry;

type AnyWorkflowV2SubworkflowDefinition = Omit<
  WorkflowV2SubworkflowDefinition<ChildWorkflowArgs, unknown>,
  "resultSchema"
> & {
  readonly resultSchema: Schema.Codec<unknown, unknown>;
};

type PublishedRegistry<
  Registry extends Readonly<Record<string, AnyWorkflowV2SubworkflowDefinition>>,
> = {
  readonly [
    Key in keyof Registry
  ]: Registry[Key] extends WorkflowV2SubworkflowDefinition<
    infer Args,
    infer Result
  >
    ? WorkflowV2SubworkflowRegistryEntry<Args, Result>
    : never;
};

export const defineWorkflowV2SubworkflowRegistry = <
  const Registry extends Readonly<
    Record<string, AnyWorkflowV2SubworkflowDefinition>
  >,
>(
  publicationRegistry: PublicationRegistry,
  registry: Registry,
): PublishedRegistry<Registry> => {
  const published: Record<string, AnyWorkflowV2SubworkflowRegistryEntry> = {};
  for (const [key, definition] of Object.entries(registry)) {
    const decoded = Schema.decodeUnknownExit(WorkflowReference)(key);
    if (Exit.isFailure(decoded)) {
      throw makePublicError(
        "VALIDATION_FAILED",
        "Subworkflow registry key must be a generated reference matching its immutable version.",
        { key },
      );
    }
    const version = workflowReferenceVersion(key);
    const release = resolvePublishedSubworkflowRelease(
      publicationRegistry,
      definition.publication.workflowId,
      version,
    );
    const runtime = assertPublishedSubworkflowDefinition(
      key,
      definition,
      release,
    );
    published[key] = Object.freeze({
      ...definition,
      version,
      ref: release.runner.ref as DurableGraphWorkflowRef<
        ChildWorkflowArgs,
        unknown
      >,
      lifecycle: {
        cancel: "restricted" as const,
        cleanup: "restricted" as const,
        contractVersion: release.lifecycleContractVersion,
      },
      children: release.subworkflowBindings.map((binding) =>
        publishedChildReference(publicationRegistry, binding),
      ),
      publication: Object.freeze({
        workflowId: release.workflowId,
        graphJson: runtime.graphJson,
        argumentMapper: {
          module: runtime.argumentMapper.module,
          exportName: runtime.argumentMapper.exportName,
          schemaName: runtime.argumentMapper.schemaName,
        },
        resultSchema: {
          module: runtime.resultSchema.module,
          exportName: runtime.resultSchema.exportName,
          schemaName: runtime.resultSchema.schemaName,
        },
        releaseChecksum: release.releaseChecksum,
        graphHash: release.graphHash,
        runnerModule: release.runner.module,
        runnerFunctionReference: release.runner.functionReference,
      }),
    });
  }
  return Object.freeze(published) as PublishedRegistry<Registry>;
};

export const defineEmptyWorkflowV2SubworkflowRegistry = () =>
  Object.freeze({}) as Readonly<Record<string, never>>;

const workflowReferenceVersion = (reference: string): number => {
  const match = /\.v([1-9]\d*)$/.exec(reference);
  const version = match?.[1] ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(version)) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Subworkflow reference version is unavailable.",
      { reference },
    );
  }
  return version;
};

const resolvePublishedSubworkflowRelease = (
  registry: PublicationRegistry,
  workflowId: string,
  version: number,
): WorkflowRelease => {
  try {
    return resolveWorkflowStart(registry, workflowId, version);
  } catch {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Subworkflow publication binding is unavailable.",
      { workflowId, version },
    );
  }
};

const assertPublishedSubworkflowDefinition = (
  reference: string,
  definition: AnyWorkflowV2SubworkflowDefinition,
  release: WorkflowRelease,
): WorkflowSubworkflowRuntimeBinding => {
  const runtime = release.subworkflowRuntime;
  if (
    runtime === undefined ||
    !sameRuntimeDescriptor(
      definition.publication.argumentMapper,
      runtime.argumentMapper,
    ) ||
    !sameRuntimeDescriptor(
      definition.publication.resultSchema,
      runtime.resultSchema,
    ) ||
    definition.mapArgs !== runtime.argumentMapper.mapArgs ||
    definition.resultSchema !== runtime.resultSchema.schema
  ) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Subworkflow graph, runner, mapper, result schema, and lifecycle must be bound to one immutable release.",
      { reference, workflowId: release.workflowId, version: release.version },
    );
  }
  return runtime;
};

const sameRuntimeDescriptor = (
  expected: {
    readonly module: string;
    readonly exportName: string;
    readonly schemaName: string;
  },
  actual: {
    readonly module: string;
    readonly exportName: string;
    readonly schemaName: string;
  },
): boolean =>
  expected.module === actual.module &&
  expected.exportName === actual.exportName &&
  expected.schemaName === actual.schemaName;

const publishedChildReference = (
  registry: PublicationRegistry,
  binding: WorkflowRelease["subworkflowBindings"][number],
): WorkflowReferenceType => {
  const dependency = resolvePublishedSubworkflowRelease(
    registry,
    binding.workflowId,
    binding.version,
  );
  if (dependency.releaseChecksum !== binding.releaseChecksum) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Subworkflow dependency checksum drifted from its immutable publication.",
      { workflowId: binding.workflowId, version: binding.version },
    );
  }
  const reference = `${binding.workflowId}.v${binding.version}`;
  const decoded = Schema.decodeUnknownExit(WorkflowReference)(reference);
  if (Exit.isFailure(decoded)) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Published subworkflow dependency has no canonical workflow reference.",
      { workflowId: binding.workflowId, version: binding.version },
    );
  }
  return decoded.value;
};

type RunSubworkflowInput<Entry> = {
  readonly step: RunDurableGraphStep;
  readonly node: SubworkflowNodeV2;
  readonly entry: Entry;
  readonly inputs: unknown;
  readonly context: Readonly<Record<string, unknown>>;
  readonly principal: unknown;
  readonly policySnapshot: unknown;
  readonly ownership: {
    readonly workspaceId: string;
    readonly parentWorkflowRunId: string;
    readonly parentComponentWorkflowId: string;
    readonly parentWorkflowVersion: number;
    readonly generation: number;
    readonly occurredAt: number;
  };
};

export function runRegisteredSubworkflow<
  Args extends ChildWorkflowArgs,
  Result,
>(
  input: RunSubworkflowInput<WorkflowV2SubworkflowRegistryEntry<Args, Result>>,
): Promise<Result>;
export function runRegisteredSubworkflow(
  input: RunSubworkflowInput<AnyWorkflowV2SubworkflowRegistryEntry>,
): Promise<unknown>;
export async function runRegisteredSubworkflow({
  step,
  node,
  entry,
  inputs,
  context,
  principal,
  policySnapshot,
  ownership,
}: RunSubworkflowInput<AnyWorkflowV2SubworkflowRegistryEntry>): Promise<unknown> {
  if (entry.version !== node.childVersion) {
    throw subworkflowFailure(
      node,
      `registry binds child version ${entry.version}, not immutable graph version ${node.childVersion}`,
    );
  }
  if (!Number.isInteger(node.childVersion) || node.childVersion < 1) {
    throw subworkflowFailure(node, "childVersion must be a positive integer");
  }
  if (!step.runWorkflow) {
    throw subworkflowFailure(node, "runWorkflow is unavailable in this runner");
  }
  const parentPrincipal = decodePrincipal(node, principal);
  const childPolicySnapshot = decodePolicySnapshot(node, policySnapshot);
  const childPrincipal = resolveChildPrincipal(
    node,
    parentPrincipal,
    entry.principal,
  );
  const mappedArgs = entry.mapArgs({
    inputs,
    context,
    principal: childPrincipal,
    policySnapshot: childPolicySnapshot,
  });
  assertJsonSafe(mappedArgs, `Subworkflow ${node.id} mapped invalid args.`);
  if (
    hasReservedWorkflowIdentityField(mappedArgs) ||
    ["workflowRunId", "idempotencyKey", "policySnapshot", "subworkflow"].some(
      (field) => field in mappedArgs,
    )
  ) {
    throw subworkflowFailure(
      node,
      "mapped args cannot override reserved workflow identity fields",
    );
  }
  const projection: SubworkflowRunLinkProjection = {
    workspaceId: ownership.workspaceId,
    parentWorkflowRunId: ownership.parentWorkflowRunId,
    parentComponentWorkflowId: ownership.parentComponentWorkflowId,
    parentWorkflowVersion: ownership.parentWorkflowVersion,
    generation: ownership.generation,
    childWorkflow: node.workflow,
    childWorkflowVersion: node.childVersion,
    childGraphJson: entry.publication.graphJson,
    childReleaseChecksum: entry.publication.releaseChecksum,
    stepName: node.stepName,
    principal: childPrincipal,
    policySnapshot: childPolicySnapshot,
  };
  const reservation = await step.runMutation(
    entry.links.reserveRef,
    { projection, occurredAt: ownership.occurredAt },
    { name: `${node.stepName}.link.reserve.v1` },
  );
  const { linkId, childWorkflowRunId } = readLinkReservation(node, reservation);
  const idempotencyKey = subworkflowRunLinkIdempotencyKey(projection);
  const childArgs = {
    ...mappedArgs,
    workspaceId: ownership.workspaceId,
    workflowRunId: childWorkflowRunId,
    idempotencyKey,
    principal: childPrincipal,
    policySnapshot: childPolicySnapshot,
    subworkflow: {
      linkId,
      parentWorkflowRunId: ownership.parentWorkflowRunId,
      parentComponentWorkflowId: ownership.parentComponentWorkflowId,
      generation: ownership.generation,
      reservedAt: ownership.occurredAt,
    },
  };
  assertMappedArgsSize(node, childArgs);
  let childResult: unknown;
  let receipt: Extract<
    SubworkflowRunLinkOutcome,
    { kind: "succeeded" }
  >["receipt"];
  try {
    const rawResult = await step.runWorkflow(entry.ref, childArgs, {
      name: node.stepName,
    });
    const decoded = Schema.decodeUnknownExit(entry.resultSchema)(rawResult);
    if (Exit.isFailure(decoded)) {
      throw subworkflowFailure(
        node,
        "child returned an invalid declared result",
      );
    }
    childResult = decoded.value;
    assertJsonSafe(
      childResult,
      `Subworkflow ${node.id} returned invalid data.`,
    );
    const encoded = JSON.stringify(childResult);
    if (encoded === undefined) {
      throw subworkflowFailure(
        node,
        "child returned a non-serializable result",
      );
    }
    if (node.payloadPolicy.resultMode === "artifact-reference") {
      const artifact = readArtifactReference(node, childResult);
      const referenceBytes = getConvexSize(artifact);
      assertArtifactReferenceBudget(node, referenceBytes);
      const owned = await step.runQuery(entry.artifacts.getOwnedRef, {
        workspaceId: ownership.workspaceId,
        workflowRunId: childWorkflowRunId,
        artifactId: artifact.artifactId,
      });
      assertOwnedArtifactReference(node, artifact, owned, childWorkflowRunId);
      assertStoredArtifactBudget(node, owned.measuredBytes);
      receipt = {
        kind: "artifact-reference",
        artifactId: artifact.artifactId,
        contentHash: artifact.contentHash,
        measuredBytes: referenceBytes,
      };
    } else {
      const measuredBytes = getConvexSize(childResult);
      assertChildResultBudget(node, measuredBytes);
      receipt = {
        kind: "bounded-inline",
        measuredBytes,
        contentHash: sha256Hex(encoded),
      };
    }
  } catch (error) {
    const outcome = isPinnedWorkflowCancellation(error)
      ? ({ kind: "canceled" } as const)
      : ({ kind: "failed", error: "Child workflow failed." } as const);
    try {
      await reconcileLink(step, entry, node, ownership, linkId, outcome);
    } catch {
      await reportReconciliationFailure(
        step,
        entry,
        node,
        ownership,
        linkId,
        outcome.kind,
      ).catch(() => undefined);
    }
    throw error;
  }
  await reconcileLink(step, entry, node, ownership, linkId, {
    kind: "succeeded",
    receipt,
  });
  return childResult;
}

export const validateWorkflowV2SubworkflowTopology = (
  graph: { readonly nodes: readonly WorkflowNodeV2[] },
  registry: Readonly<Record<string, AnyWorkflowV2SubworkflowRegistryEntry>>,
  policy: WorkflowV2SubworkflowPolicy,
): void => {
  if (
    !Number.isInteger(policy.maxDepth) ||
    policy.maxDepth < 1 ||
    !Number.isInteger(policy.maxFanOut) ||
    policy.maxFanOut < 1
  ) {
    throw topologyFailure("depth and fan-out limits must be positive integers");
  }
  const roots = graph.nodes
    .filter((node): node is SubworkflowNodeV2 => node.kind === "subworkflow")
    .map((node) => node.workflow);
  let fanOut = roots.length;
  if (fanOut > policy.maxFanOut) {
    throw topologyFailure(
      `declared child fan-out ${fanOut} exceeds limit ${policy.maxFanOut}`,
    );
  }
  const visit = (reference: string, depth: number, path: readonly string[]) => {
    if (path.includes(reference)) {
      throw topologyFailure(
        `cycle detected at ${[...path, reference].join(" -> ")}`,
      );
    }
    if (depth > policy.maxDepth) {
      throw topologyFailure(
        `nesting depth ${depth} exceeds limit ${policy.maxDepth}`,
      );
    }
    const entry = registry[reference];
    if (!entry) {
      throw topologyFailure(`missing generated registry entry ${reference}`);
    }
    const nextPath = [...path, reference];
    for (const child of entry.children) {
      fanOut += 1;
      if (fanOut > policy.maxFanOut) {
        throw topologyFailure(
          `declared child fan-out exceeds limit ${policy.maxFanOut}`,
        );
      }
      visit(child, depth + 1, nextPath);
    }
  };
  for (const root of roots) visit(root, 1, []);
};

const decodePrincipal = (
  node: SubworkflowNodeV2,
  principal: unknown,
): WorkflowPrincipalType => {
  const decoded = Schema.decodeUnknownExit(DurableWorkflowPrincipal)(principal);
  if (Exit.isFailure(decoded)) {
    throw subworkflowFailure(node, "parent principal is invalid");
  }
  return decoded.value;
};

const resolveChildPrincipal = (
  node: SubworkflowNodeV2,
  parent: WorkflowPrincipalType,
  policy: AnyWorkflowV2SubworkflowRegistryEntry["principal"],
): WorkflowPrincipalType => {
  if (policy.kind === "inherit") return parent;
  const parentGrants = new Set(parent.grants);
  if (policy.grants.some((grant) => !parentGrants.has(grant))) {
    throw subworkflowFailure(
      node,
      "narrowed child principal cannot add grants",
    );
  }
  return { ...parent, grants: [...policy.grants] };
};

const assertMappedArgsSize = (node: SubworkflowNodeV2, args: unknown): void => {
  const budget = Math.min(node.payloadPolicy.maxInputBytes, 512 << 10);
  if (!Number.isFinite(budget) || budget < 0) {
    throw subworkflowFailure(
      node,
      "mapped args budget must be finite and nonnegative",
    );
  }
  assertJsonSafe(args, `Subworkflow ${node.id} mapped invalid args.`);
  const size = getConvexSize(args);
  if (size > budget) {
    throw subworkflowFailure(
      node,
      `mapped args use ${size} bytes above the ${budget} bytes limit`,
    );
  }
};

const readLinkReservation = (
  node: SubworkflowNodeV2,
  value: unknown,
): { readonly linkId: string; readonly childWorkflowRunId: string } => {
  if (
    !isRecord(value) ||
    typeof value.linkId !== "string" ||
    value.linkId.length === 0 ||
    typeof value.childWorkflowRunId !== "string" ||
    value.childWorkflowRunId.length === 0
  ) {
    throw subworkflowFailure(
      node,
      "link reservation returned invalid product run identities",
    );
  }
  return {
    linkId: value.linkId,
    childWorkflowRunId: value.childWorkflowRunId,
  };
};

const decodePolicySnapshot = (
  node: SubworkflowNodeV2,
  snapshot: unknown,
): WorkflowPolicySnapshotType => {
  const decoded = Schema.decodeUnknownExit(WorkflowPolicySnapshot)(snapshot);
  if (Exit.isFailure(decoded)) {
    throw subworkflowFailure(node, "parent policy snapshot is invalid");
  }
  return decoded.value;
};

type ChildArtifactReference = {
  readonly artifactId: string;
  readonly contentHash: string;
  readonly measuredBytes: number;
};

const readArtifactReference = (
  node: SubworkflowNodeV2,
  result: unknown,
): ChildArtifactReference => {
  if (
    !isRecord(result) ||
    typeof result.artifactId !== "string" ||
    result.artifactId.length === 0 ||
    typeof result.contentHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(result.contentHash) ||
    typeof result.measuredBytes !== "number" ||
    !Number.isSafeInteger(result.measuredBytes) ||
    result.measuredBytes < 0
  ) {
    throw subworkflowFailure(
      node,
      "artifact result must include an immutable ID, content hash, and measured byte count",
    );
  }
  return {
    artifactId: result.artifactId,
    contentHash: result.contentHash,
    measuredBytes: result.measuredBytes,
  };
};

function assertOwnedArtifactReference(
  node: SubworkflowNodeV2,
  expected: ChildArtifactReference,
  owned: unknown,
  childWorkflowRunId: string,
): asserts owned is ChildArtifactReference & {
  readonly workflowRunId: string;
} {
  if (
    !isRecord(owned) ||
    owned.artifactId !== expected.artifactId ||
    owned.contentHash !== expected.contentHash ||
    owned.measuredBytes !== expected.measuredBytes ||
    owned.workflowRunId !== childWorkflowRunId
  ) {
    throw subworkflowFailure(
      node,
      "artifact result failed durable ownership and integrity validation",
    );
  }
}

const assertArtifactReferenceBudget = (
  node: SubworkflowNodeV2,
  measuredBytes: number,
): void => {
  if (
    !Number.isSafeInteger(measuredBytes) ||
    measuredBytes < 0 ||
    measuredBytes > MAX_SUBWORKFLOW_RESULT_BYTES
  ) {
    throw subworkflowFailure(
      node,
      `artifact reference uses ${measuredBytes} bytes above the ${MAX_SUBWORKFLOW_RESULT_BYTES} bytes limit`,
    );
  }
};

const assertStoredArtifactBudget = (
  node: SubworkflowNodeV2,
  measuredBytes: number,
): void => {
  const budget = node.payloadPolicy.maxResultBytes;
  if (
    !Number.isSafeInteger(measuredBytes) ||
    measuredBytes < 0 ||
    !Number.isSafeInteger(budget) ||
    budget < 0 ||
    measuredBytes > budget
  ) {
    throw subworkflowFailure(
      node,
      `stored artifact uses ${measuredBytes} bytes above the ${budget} bytes node limit`,
    );
  }
};

const assertChildResultBudget = (
  node: SubworkflowNodeV2,
  measuredBytes: number,
): void => {
  const budget = Math.min(
    node.payloadPolicy.maxResultBytes,
    MAX_SUBWORKFLOW_RESULT_BYTES,
  );
  if (
    !Number.isSafeInteger(measuredBytes) ||
    measuredBytes < 0 ||
    measuredBytes > budget
  ) {
    throw subworkflowFailure(
      node,
      `child result uses ${measuredBytes} bytes above the ${budget} bytes limit`,
    );
  }
};

const reconcileLink = (
  step: RunDurableGraphStep,
  entry: AnyWorkflowV2SubworkflowRegistryEntry,
  node: SubworkflowNodeV2,
  ownership: RunSubworkflowInput<AnyWorkflowV2SubworkflowRegistryEntry>["ownership"],
  linkId: string,
  outcome: SubworkflowRunLinkOutcome,
): Promise<unknown> =>
  step.runMutation(
    entry.links.reconcileRef,
    {
      workspaceId: ownership.workspaceId,
      linkId,
      outcome,
      occurredAt: ownership.occurredAt,
    },
    { name: `${node.stepName}.link.reconcile.v1` },
  );

const reportReconciliationFailure = (
  step: RunDurableGraphStep,
  entry: AnyWorkflowV2SubworkflowRegistryEntry,
  node: SubworkflowNodeV2,
  ownership: RunSubworkflowInput<AnyWorkflowV2SubworkflowRegistryEntry>["ownership"],
  linkId: string,
  primaryOutcome: "failed" | "canceled",
): Promise<unknown> =>
  step.runMutation(
    entry.links.reportReconciliationFailureRef,
    {
      workspaceId: ownership.workspaceId,
      linkId,
      primaryOutcome,
      issue: "SUBWORKFLOW_LINK_RECONCILIATION_FAILED",
      occurredAt: ownership.occurredAt,
    },
    { name: `${node.stepName}.link.reconciliation-failure.v1` },
  );

const isPinnedWorkflowCancellation = (error: unknown): boolean =>
  error instanceof Error && error.message === "Canceled";

const subworkflowFailure = (node: SubworkflowNodeV2, issue: string) =>
  makePublicError(
    "VALIDATION_FAILED",
    `Workflow subworkflow compilation failed at ${node.id} (${node.stepName}): ${issue}`,
    { nodeId: node.id, stepName: node.stepName, issue },
  );

const topologyFailure = (issue: string) =>
  makePublicError(
    "VALIDATION_FAILED",
    `Workflow subworkflow topology failed: ${issue}.`,
    { issue },
  );

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
