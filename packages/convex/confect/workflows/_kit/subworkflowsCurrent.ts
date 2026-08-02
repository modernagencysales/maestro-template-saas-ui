import type { FunctionReference } from "convex/server";
import { getConvexSize, v } from "convex/values";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { makePublicError, TemplatePublicError } from "../../shared/errors";
import { sha256Hex } from "../../shared/sha256";
import {
  WorkflowReference,
  WorkflowStepName,
  type WorkflowNodeV2,
  type WorkflowReference as WorkflowReferenceType,
} from "../graphCurrent";
import { planBoundedBatch, type BoundedBatchPlanBatch } from "./boundedBatch";
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
} from "./publicationCurrent";

export { scheduledSubworkflowFinding } from "./workflowValidationFindings";

type SubworkflowNodeV2 = Extract<WorkflowNodeV2, { kind: "subworkflow" }>;
type BoundedSubworkflowBatchNodeV2 = Extract<
  WorkflowNodeV2,
  { kind: "bounded-subworkflow-batch" }
>;
type ChildWorkflowNodeV2 = SubworkflowNodeV2 | BoundedSubworkflowBatchNodeV2;
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
export type WorkflowV2BoundedBatchSource = {
  readonly items: readonly unknown[];
  readonly stableIdentities?: readonly string[];
};
export type WorkflowV2BoundedBatchEnvelope = WorkflowV2SubworkflowEnvelope & {
  readonly batch: {
    readonly waveOrdinal: number;
    readonly batchOrdinal: number;
    readonly itemOrdinals: readonly number[];
    readonly items: readonly unknown[];
  };
};
export type WorkflowV2BoundedBatchBinding = {
  readonly selectItems: (
    envelope: WorkflowV2SubworkflowEnvelope,
  ) => WorkflowV2BoundedBatchSource;
  readonly mapBatchArgs: (
    envelope: WorkflowV2BoundedBatchEnvelope,
  ) => MappedChildArgs;
};
export type WorkflowV2BoundedBatchPublicationBinding = {
  readonly selectItems: {
    readonly module: string;
    readonly exportName: string;
  };
  readonly mapBatchArgs: {
    readonly module: string;
    readonly exportName: string;
    readonly schemaName: string;
  };
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
    readonly boundedBatch?: WorkflowV2BoundedBatchPublicationBinding;
  };
  readonly links: {
    readonly reserveRef: DurableGraphStepRef<"mutation">;
    readonly recoverReservationRef: DurableGraphStepRef<"query">;
    readonly persistUnresolvedReservationRef: DurableGraphStepRef<"mutation">;
    readonly persistUnresolvedSuccessRef: DurableGraphStepRef<"mutation">;
    readonly recoverUnresolvedSuccessRef: DurableGraphStepRef<"query">;
    readonly resolveUnresolvedSuccessRef: DurableGraphStepRef<"mutation">;
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
> = Omit<WorkflowV2SubworkflowDefinition<Args, Result>, "publication"> & {
  readonly boundedBatch?: WorkflowV2BoundedBatchBinding;
  readonly version: number;
  readonly ref: DurableGraphWorkflowRef<Args, Result>;
  readonly lifecycle: {
    readonly cancel: "restricted";
    readonly cleanup: "restricted";
    readonly contractVersion: number;
  };
  readonly children: readonly WorkflowReferenceType[];
  readonly childStartMultiplicities: readonly {
    readonly workflow: WorkflowReferenceType;
    readonly maxChildStarts: number;
  }[];
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
  readonly boundedBatch?: WorkflowV2BoundedBatchBinding;
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
  readonly childStartMultiplicities?: readonly {
    readonly workflow: WorkflowReferenceType;
    readonly maxChildStarts: number;
  }[];
  readonly publication: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["publication"];
  readonly links: {
    readonly reserveRef: DurableGraphStepRef<"mutation">;
    readonly recoverReservationRef?: DurableGraphStepRef<"query">;
    readonly persistUnresolvedReservationRef?: DurableGraphStepRef<"mutation">;
    readonly persistUnresolvedSuccessRef?: DurableGraphStepRef<"mutation">;
    readonly recoverUnresolvedSuccessRef?: DurableGraphStepRef<"query">;
    readonly resolveUnresolvedSuccessRef?: DurableGraphStepRef<"mutation">;
    readonly reconcileRef: DurableGraphStepRef<"mutation">;
    readonly reportReconciliationFailureRef: DurableGraphStepRef<"mutation">;
  };
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
      ...(runtime.boundedBatch ? { boundedBatch: runtime.boundedBatch } : {}),
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
      childStartMultiplicities: release.subworkflowBindings.map((binding) => ({
        workflow: publishedChildReference(publicationRegistry, binding),
        maxChildStarts: binding.maxChildStarts ?? 1,
      })),
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
): Omit<WorkflowSubworkflowRuntimeBinding, "boundedBatch"> & {
  readonly boundedBatch?: WorkflowV2BoundedBatchBinding;
} => {
  const runtime = release.subworkflowRuntime;
  const publishedBoundedBatch = runtime?.boundedBatch;
  const expectedBoundedBatch = definition.publication.boundedBatch;
  const boundedBatchMatches =
    expectedBoundedBatch === undefined
      ? publishedBoundedBatch === undefined
      : publishedBoundedBatch !== undefined &&
        expectedBoundedBatch.selectItems.module ===
          publishedBoundedBatch.selectItems.module &&
        expectedBoundedBatch.selectItems.exportName ===
          publishedBoundedBatch.selectItems.exportName &&
        expectedBoundedBatch.mapBatchArgs.module ===
          publishedBoundedBatch.mapBatchArgs.module &&
        expectedBoundedBatch.mapBatchArgs.exportName ===
          publishedBoundedBatch.mapBatchArgs.exportName &&
        expectedBoundedBatch.mapBatchArgs.schemaName ===
          publishedBoundedBatch.mapBatchArgs.schemaName;
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
    definition.resultSchema !== runtime.resultSchema.schema ||
    !boundedBatchMatches
  ) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Subworkflow graph, runner, mapper, result schema, and lifecycle must be bound to one immutable release.",
      { reference, workflowId: release.workflowId, version: release.version },
    );
  }
  const { boundedBatch: _publishedDescriptor, ...runtimeWithoutBoundedBatch } =
    runtime;
  void _publishedDescriptor;
  return {
    ...runtimeWithoutBoundedBatch,
    ...(publishedBoundedBatch
      ? {
          boundedBatch: Object.freeze({
            selectItems: publishedBoundedBatch.selectItems
              .selectItems as WorkflowV2BoundedBatchBinding["selectItems"],
            mapBatchArgs: publishedBoundedBatch.mapBatchArgs
              .mapBatchArgs as WorkflowV2BoundedBatchBinding["mapBatchArgs"],
          }),
        }
      : {}),
  };
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
  const reserveArgs = { projection, occurredAt: ownership.occurredAt };
  const reserveOptions = { name: `${node.stepName}.link.reserve.v1` };
  const idempotencyKey = subworkflowRunLinkIdempotencyKey(projection);
  const reservation = await step.runMutation(
    entry.links.reserveRef,
    reserveArgs,
    reserveOptions,
  );
  let recoveredReservation: {
    readonly linkId: string;
    readonly childWorkflowRunId: string;
  };
  try {
    recoveredReservation = readLinkReservation(node, reservation);
  } catch (error) {
    try {
      const recoveryRef = entry.links.recoverReservationRef;
      if (recoveryRef === undefined) {
        throw subworkflowFailure(
          node,
          "generated authoritative reservation recovery is unavailable",
        );
      }
      const authoritative = await step.runQuery(
        recoveryRef,
        { workspaceId: ownership.workspaceId, idempotencyKey },
        { name: `${node.stepName}.link.reserve-recovery.v1` },
      );
      recoveredReservation = readLinkReservation(node, authoritative);
      try {
        await reconcileLink(
          step,
          entry,
          node,
          ownership,
          recoveredReservation.linkId,
          { kind: "failed", error: "Child workflow failed." },
        );
      } catch (reconcileError) {
        const persistReservationRef =
          entry.links.persistUnresolvedReservationRef;
        if (persistReservationRef === undefined) {
          throw subworkflowFailure(
            node,
            "generated durable unresolved-reservation persistence is unavailable",
          );
        }
        await step.runMutation(
          persistReservationRef,
          {
            workspaceId: ownership.workspaceId,
            linkId: recoveredReservation.linkId,
            idempotencyKey,
            occurredAt: ownership.occurredAt,
          },
          { name: `${node.stepName}.link.reservation-unresolved.v1` },
        );
        try {
          await reportReconciliationFailure(
            step,
            entry,
            node,
            ownership,
            recoveredReservation.linkId,
            "failed",
            "SUBWORKFLOW_RESERVATION_RESPONSE_INVALID",
          );
        } catch {
          throw subworkflowFailure(
            node,
            "reservation recovery was authoritative but reconciliation and its durable report remain unresolved",
          );
        }
        throw reconcileError;
      }
    } catch (recoveryError) {
      if (recoveryError instanceof TemplatePublicError) throw recoveryError;
      throw subworkflowFailure(
        node,
        "reservation response was invalid and deterministic replay could not recover it",
      );
    }
    throw error;
  }
  const { linkId, childWorkflowRunId } = recoveredReservation;
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
  let childResult: unknown;
  let receipt: Extract<
    SubworkflowRunLinkOutcome,
    { kind: "succeeded" }
  >["receipt"];
  const unresolvedSuccessRef = entry.links.recoverUnresolvedSuccessRef;
  const unresolvedSuccess =
    unresolvedSuccessRef === undefined
      ? null
      : readUnresolvedSuccess(
          node,
          await step.runQuery(
            unresolvedSuccessRef,
            { workspaceId: ownership.workspaceId, linkId },
            { name: `${node.stepName}.link.success-recovery.v1` },
          ),
        );
  if (unresolvedSuccess !== null) {
    childResult = unresolvedSuccess.childResult;
    receipt = unresolvedSuccess.receipt;
    const decoded = Schema.decodeUnknownExit(entry.resultSchema)(childResult);
    if (Exit.isFailure(decoded)) {
      throw subworkflowFailure(
        node,
        "durable unresolved child result is invalid",
      );
    }
    childResult = decoded.value;
  } else
    try {
      assertMappedArgsSize(node, childArgs);
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
        try {
          await reportReconciliationFailure(
            step,
            entry,
            node,
            ownership,
            linkId,
            outcome.kind,
          );
        } catch {
          throw subworkflowFailure(
            node,
            "child failure reconciliation and its durable report remain unresolved",
          );
        }
      }
      throw error;
    }
  try {
    await reconcileLink(step, entry, node, ownership, linkId, {
      kind: "succeeded",
      receipt,
    });
  } catch {
    if (unresolvedSuccess === null) {
      const persistRef = entry.links.persistUnresolvedSuccessRef;
      if (persistRef === undefined) {
        throw subworkflowFailure(
          node,
          "generated durable unresolved-success persistence is unavailable",
        );
      }
      await step.runMutation(
        persistRef,
        {
          workspaceId: ownership.workspaceId,
          linkId,
          receipt,
          childResult,
          occurredAt: ownership.occurredAt,
        },
        { name: `${node.stepName}.link.success-unresolved.v1` },
      );
    }
    try {
      await reportReconciliationFailure(
        step,
        entry,
        node,
        ownership,
        linkId,
        "succeeded",
        "SUBWORKFLOW_SUCCESS_RECONCILIATION_FAILED",
      );
    } catch {
      throw subworkflowFailure(
        node,
        "child succeeded but reconciliation and its durable failure report remain unresolved; retry reattempts both stable steps",
      );
    }
    throw subworkflowFailure(
      node,
      "child succeeded but durable link reconciliation failed",
    );
  }
  if (unresolvedSuccess !== null) {
    const resolveRef = entry.links.resolveUnresolvedSuccessRef;
    if (resolveRef === undefined) {
      throw subworkflowFailure(
        node,
        "generated durable unresolved-success resolution is unavailable",
      );
    }
    await step.runMutation(
      resolveRef,
      {
        workspaceId: ownership.workspaceId,
        linkId,
        occurredAt: ownership.occurredAt,
      },
      { name: `${node.stepName}.link.success-resolved.v1` },
    );
  }
  return childResult;
}

export type RunRegisteredBoundedSubworkflowBatchInput = Omit<
  RunSubworkflowInput<AnyWorkflowV2SubworkflowRegistryEntry>,
  "node"
> & { readonly node: BoundedSubworkflowBatchNodeV2 };
export type BoundedSubworkflowBatchResult =
  | {
      readonly kind: "empty";
      readonly itemCount: 0;
      readonly batchCount: 0;
      readonly waveCount: 0;
      readonly batches: readonly [];
    }
  | {
      readonly kind: "completed";
      readonly itemCount: number;
      readonly batchCount: number;
      readonly waveCount: number;
      readonly batches: readonly {
        readonly waveOrdinal: number;
        readonly batchOrdinal: number;
        readonly itemOrdinals: readonly number[];
        readonly result: unknown;
      }[];
    };
const prepareBoundedSubworkflowBatch = (input: {
  readonly node: BoundedSubworkflowBatchNodeV2;
  readonly binding: WorkflowV2BoundedBatchBinding;
  readonly envelope: WorkflowV2SubworkflowEnvelope;
  readonly source: WorkflowV2BoundedBatchSource;
  readonly waveOrdinal: number;
  readonly batch: BoundedBatchPlanBatch;
}) => {
  const itemOrdinals = input.batch.items.map((item) => item.ordinal);
  const items = itemOrdinals.map((ordinal) => input.source.items[ordinal]);
  const identityHash = sha256Hex(
    input.node.stepName +
      ":" +
      input.batch.items.map((item) => item.instanceSuffix).join(","),
  ).slice(0, 16);
  const stepName = Schema.decodeSync(WorkflowStepName)(
    "batch.v" + input.node.childVersion + ".i-k16-" + identityHash,
  );
  const childNode: SubworkflowNodeV2 = {
    id: input.node.id + ".batch." + input.batch.ordinal,
    kind: "subworkflow",
    workflow: input.node.workflow,
    childVersion: input.node.childVersion,
    label: input.node.label + " batch " + input.batch.ordinal,
    stepName,
    payloadPolicy: input.node.payloadPolicy,
    semanticRuleIds: input.node.semanticRuleIds,
    failurePolicy: input.node.failurePolicy,
  };
  let mappedArgs: MappedChildArgs;
  try {
    mappedArgs = input.binding.mapBatchArgs({
      ...input.envelope,
      batch: {
        waveOrdinal: input.waveOrdinal,
        batchOrdinal: input.batch.ordinal,
        itemOrdinals,
        items,
      },
    });
  } catch {
    throw boundedBatchFailure(
      input.node,
      "generated batch argument mapper rejected the input",
    );
  }
  if (!isRecord(mappedArgs)) {
    throw boundedBatchFailure(
      input.node,
      "generated batch argument mapper returned invalid args",
    );
  }
  if (
    hasReservedWorkflowIdentityField(mappedArgs) ||
    ["workflowRunId", "idempotencyKey", "policySnapshot", "subworkflow"].some(
      (field) => field in mappedArgs,
    )
  ) {
    throw boundedBatchFailure(
      input.node,
      "mapped args cannot override reserved workflow identity fields",
    );
  }
  assertMappedArgsSize(childNode, mappedArgs);
  return { childNode, itemOrdinals, mappedArgs };
};
export const runRegisteredBoundedSubworkflowBatch = async ({
  step,
  node,
  entry,
  inputs,
  context,
  principal,
  policySnapshot,
  ownership,
}: RunRegisteredBoundedSubworkflowBatchInput): Promise<BoundedSubworkflowBatchResult> => {
  if (entry.version !== node.childVersion) {
    throw boundedBatchFailure(node, "immutable child version binding mismatch");
  }
  const binding = entry.boundedBatch;
  if (binding === undefined) {
    throw boundedBatchFailure(
      node,
      "generated bounded batch binding is unavailable",
    );
  }
  const parentPrincipal = decodePrincipal(node, principal);
  const childPolicySnapshot = decodePolicySnapshot(node, policySnapshot);
  const childPrincipal = resolveChildPrincipal(
    node,
    parentPrincipal,
    entry.principal,
  );
  const envelope: WorkflowV2SubworkflowEnvelope = {
    inputs,
    context,
    principal: childPrincipal,
    policySnapshot: childPolicySnapshot,
  };
  let source: WorkflowV2BoundedBatchSource;
  try {
    source = binding.selectItems(envelope);
  } catch {
    throw boundedBatchFailure(
      node,
      "generated item selector rejected the input",
    );
  }
  if (!isRecord(source) || !Array.isArray(source.items)) {
    throw boundedBatchFailure(
      node,
      "generated item selector returned an invalid source",
    );
  }
  if (
    source.stableIdentities !== undefined &&
    (!Array.isArray(source.stableIdentities) ||
      source.stableIdentities.length !== source.items.length)
  ) {
    throw boundedBatchFailure(
      node,
      "stable item identities do not match the selected items",
    );
  }
  const planned = planBoundedBatch({
    maxItems: node.maxItems,
    batchSize: node.batchSize,
    fanOut: node.fanOut,
    items:
      source.stableIdentities === undefined
        ? { kind: "ordinals", count: source.items.length }
        : { kind: "stable-identities", identities: source.stableIdentities },
  });
  if (Result.isFailure(planned)) {
    throw boundedBatchFailure(
      node,
      "selected items exceed the declared bounded batch contract",
    );
  }
  if (planned.success.empty) {
    const result: BoundedSubworkflowBatchResult = {
      kind: "empty",
      itemCount: 0,
      batchCount: 0,
      waveCount: 0,
      batches: [],
    };
    assertBoundedBatchResultBudget(node, result);
    return result;
  }
  const prepared = new Map<
    number,
    ReturnType<typeof prepareBoundedSubworkflowBatch>
  >();
  for (const wave of planned.success.waves) {
    for (const batch of wave.batches) {
      prepared.set(
        batch.ordinal,
        prepareBoundedSubworkflowBatch({
          node,
          binding,
          envelope,
          source,
          waveOrdinal: wave.ordinal,
          batch,
        }),
      );
    }
  }
  const completed: Array<{
    readonly waveOrdinal: number;
    readonly batchOrdinal: number;
    readonly itemOrdinals: readonly number[];
    readonly result: unknown;
  }> = [];
  for (const wave of planned.success.waves) {
    const settled = await Promise.allSettled(
      wave.batches.map(async (batch) => {
        const preparedBatch = prepared.get(batch.ordinal);
        if (preparedBatch === undefined) {
          throw boundedBatchFailure(
            node,
            "prepared batch identity is unavailable",
          );
        }
        const { childNode, itemOrdinals, mappedArgs } = preparedBatch;
        const batchEntry: AnyWorkflowV2SubworkflowRegistryEntry = {
          ...entry,
          mapArgs: () => mappedArgs,
        };
        const result = await runRegisteredSubworkflow({
          step,
          node: childNode,
          entry: batchEntry,
          inputs,
          context,
          principal: childPrincipal,
          policySnapshot: childPolicySnapshot,
          ownership,
        });
        return {
          waveOrdinal: wave.ordinal,
          batchOrdinal: batch.ordinal,
          itemOrdinals,
          result,
        };
      }),
    );
    const failed = settled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed !== undefined) throw failed.reason;
    completed.push(
      ...settled.map(
        (result) =>
          (result as PromiseFulfilledResult<(typeof completed)[number]>).value,
      ),
    );
    assertBoundedBatchResultBudget(node, {
      kind: "completed",
      itemCount: planned.success.itemCount,
      batchCount: planned.success.batchCount,
      waveCount: planned.success.waveCount,
      batches: completed,
    });
  }
  const result: BoundedSubworkflowBatchResult = {
    kind: "completed",
    itemCount: planned.success.itemCount,
    batchCount: planned.success.batchCount,
    waveCount: planned.success.waveCount,
    batches: completed,
  };
  assertBoundedBatchResultBudget(node, result);
  return result;
};
const assertBoundedBatchResultBudget = (
  node: BoundedSubworkflowBatchNodeV2,
  result: BoundedSubworkflowBatchResult,
): void => {
  const budget = Math.min(
    node.payloadPolicy.maxResultBytes,
    MAX_SUBWORKFLOW_RESULT_BYTES,
  );
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw boundedBatchFailure(
      node,
      "aggregate result budget must be a nonnegative safe integer",
    );
  }
  assertJsonSafe(
    result,
    `Bounded subworkflow batch ${node.id} returned invalid data.`,
  );
  const measuredBytes = getConvexSize(result);
  if (measuredBytes > budget) {
    throw boundedBatchFailure(
      node,
      `aggregate result uses ${measuredBytes} bytes above the ${budget} bytes limit`,
    );
  }
};
const boundedBatchFailure = (
  node: BoundedSubworkflowBatchNodeV2,
  issue: string,
) =>
  makePublicError(
    "VALIDATION_FAILED",
    "Workflow bounded subworkflow batch rejected.",
    {
      nodeId: node.id,
      code: "BOUNDED_SUBWORKFLOW_BATCH_INVALID",
      issue,
      repair:
        "Use a generated versioned bounded subworkflow binding with maxItems, batchSize, and fanOut within policy.",
    },
  );
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
  const roots = graph.nodes.filter(
    (node): node is ChildWorkflowNodeV2 =>
      node.kind === "subworkflow" || node.kind === "bounded-subworkflow-batch",
  );
  let childStarts = 0;
  const addStarts = (value: number): void => {
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      childStarts > Number.MAX_SAFE_INTEGER - value
    ) {
      throw topologyFailure("declared child starts overflow a safe integer");
    }
    childStarts += value;
    if (childStarts > policy.maxFanOut) {
      throw topologyFailure(
        `declared child starts ${childStarts} exceed limit ${policy.maxFanOut}`,
      );
    }
  };
  const multiplyStarts = (left: number, right: number): number => {
    if (
      !Number.isSafeInteger(left) ||
      left < 1 ||
      !Number.isSafeInteger(right) ||
      right < 1 ||
      left > Math.floor(Number.MAX_SAFE_INTEGER / right)
    ) {
      throw topologyFailure(
        "declared child start multiplicity overflows a safe integer",
      );
    }
    return left * right;
  };
  const visit = (
    reference: string,
    depth: number,
    path: readonly string[],
    parentInstances: number,
  ) => {
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
    const childBindings =
      entry.childStartMultiplicities ??
      entry.children.map((workflow) => ({ workflow, maxChildStarts: 1 }));
    for (const child of childBindings) {
      const childInstances = multiplyStarts(
        parentInstances,
        child.maxChildStarts,
      );
      addStarts(childInstances);
      visit(child.workflow, depth + 1, nextPath, childInstances);
    }
  };
  for (const root of roots) {
    const rootInstances =
      root.kind === "bounded-subworkflow-batch"
        ? Math.ceil(root.maxItems / root.batchSize)
        : 1;
    addStarts(rootInstances);
    const entry = registry[root.workflow];
    if (!entry) {
      throw topologyFailure(
        "missing generated registry entry " + root.workflow,
      );
    }
    if (entry.version !== root.childVersion) {
      throw topologyFailure(
        "registry binds child version " +
          entry.version +
          ", not " +
          root.childVersion,
      );
    }
    visit(root.workflow, 1, [], rootInstances);
  }
};

const decodePrincipal = (
  node: ChildWorkflowNodeV2,
  principal: unknown,
): WorkflowPrincipalType => {
  const decoded = Schema.decodeUnknownExit(DurableWorkflowPrincipal)(principal);
  if (Exit.isFailure(decoded)) {
    throw subworkflowFailure(node, "parent principal is invalid");
  }
  return decoded.value;
};

const resolveChildPrincipal = (
  node: ChildWorkflowNodeV2,
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

const readUnresolvedSuccess = (
  node: SubworkflowNodeV2,
  value: unknown,
): {
  readonly receipt: Extract<
    SubworkflowRunLinkOutcome,
    { kind: "succeeded" }
  >["receipt"];
  readonly childResult: unknown;
} | null => {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || !("receipt" in value)) return null;
  if (!isRecord(value.receipt)) {
    throw subworkflowFailure(node, "durable unresolved success is invalid");
  }
  const receipt = value.receipt;
  if (
    (receipt.kind !== "bounded-inline" &&
      receipt.kind !== "artifact-reference") ||
    typeof receipt.measuredBytes !== "number" ||
    !Number.isSafeInteger(receipt.measuredBytes) ||
    receipt.measuredBytes < 0 ||
    receipt.measuredBytes > MAX_SUBWORKFLOW_RESULT_BYTES ||
    typeof receipt.contentHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(receipt.contentHash) ||
    (receipt.artifactId !== undefined &&
      (typeof receipt.artifactId !== "string" ||
        receipt.artifactId.length === 0))
  ) {
    throw subworkflowFailure(
      node,
      "durable unresolved success receipt is invalid",
    );
  }
  return {
    receipt: {
      kind: receipt.kind,
      measuredBytes: receipt.measuredBytes,
      contentHash: receipt.contentHash,
      ...(typeof receipt.artifactId === "string"
        ? { artifactId: receipt.artifactId }
        : {}),
    },
    childResult: value.childResult,
  };
};

const decodePolicySnapshot = (
  node: ChildWorkflowNodeV2,
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
  primaryOutcome: "succeeded" | "failed" | "canceled",
  issue = "SUBWORKFLOW_LINK_RECONCILIATION_FAILED",
): Promise<unknown> =>
  step.runMutation(
    entry.links.reportReconciliationFailureRef,
    {
      workspaceId: ownership.workspaceId,
      linkId,
      primaryOutcome,
      issue,
      occurredAt: ownership.occurredAt,
    },
    { name: `${node.stepName}.link.reconciliation-failure.v1` },
  );

const isPinnedWorkflowCancellation = (error: unknown): boolean =>
  error instanceof Error && error.message === "Canceled";

const subworkflowFailure = (node: ChildWorkflowNodeV2, issue: string) =>
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
