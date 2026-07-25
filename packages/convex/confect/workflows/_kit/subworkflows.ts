import type { FunctionReference } from "convex/server";
import { getConvexSize } from "convex/values";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
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
  WorkflowPrincipal,
  hasReservedWorkflowIdentityField,
  type WorkflowPrincipal as WorkflowPrincipalType,
} from "./principal";

type SubworkflowNodeV2 = Extract<WorkflowNodeV2, { kind: "subworkflow" }>;
type MappedChildArgs = Readonly<Record<string, unknown>>;
type ChildWorkflowArgs = MappedChildArgs & {
  readonly principal: WorkflowPrincipalType;
  readonly policySnapshot?: unknown;
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

export type WorkflowV2SubworkflowRegistryEntry<
  Args extends ChildWorkflowArgs,
  Result,
> = {
  readonly version: number;
  readonly ref: DurableGraphWorkflowRef<Args, Result>;
  readonly mapArgs: (
    envelope: WorkflowV2SubworkflowEnvelope,
  ) => Omit<Args, "principal" | "policySnapshot">;
  readonly resultSchema: Schema.Schema<Result>;
  readonly principal:
    | { readonly kind: "inherit" }
    | { readonly kind: "narrow"; readonly grants: readonly string[] };
  readonly lifecycle: {
    readonly cancel: "cascade";
    readonly cleanup: "cascade-async";
  };
  readonly children: readonly WorkflowReferenceType[];
  readonly links: {
    readonly reserveRef: DurableGraphStepRef<"mutation">;
    readonly reconcileRef: DurableGraphStepRef<"mutation">;
  };
};

export type AnyWorkflowV2SubworkflowRegistryEntry = {
  readonly version: number;
  readonly ref: DurableGraphWorkflowRef<AnyChildWorkflowArgs, unknown>;
  readonly mapArgs: (
    envelope: WorkflowV2SubworkflowEnvelope,
  ) => MappedChildArgs;
  readonly resultSchema: Schema.Schema.AnyNoContext;
  readonly principal: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["principal"];
  readonly lifecycle: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["lifecycle"];
  readonly children: readonly WorkflowReferenceType[];
  readonly links: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["links"];
};

export type WorkflowV2SubworkflowPolicy = {
  readonly maxDepth: number;
  readonly maxFanOut: number;
};

export const defineWorkflowV2Subworkflow = <
  Args extends ChildWorkflowArgs,
  Result,
>(
  entry: WorkflowV2SubworkflowRegistryEntry<Args, Result>,
): WorkflowV2SubworkflowRegistryEntry<Args, Result> => entry;

export const defineWorkflowV2SubworkflowRegistry = <
  const Registry extends Readonly<
    Record<string, AnyWorkflowV2SubworkflowRegistryEntry>
  >,
>(
  registry: Registry,
): Registry => {
  for (const [key, entry] of Object.entries(registry)) {
    const decoded = Schema.decodeUnknownEither(WorkflowReference)(key);
    const invalidChild = entry.children.some((child) =>
      Either.isLeft(Schema.decodeUnknownEither(WorkflowReference)(child)),
    );
    if (
      Either.isLeft(decoded) ||
      !key.endsWith(`.v${entry.version}`) ||
      invalidChild
    ) {
      throw makePublicError(
        "VALIDATION_FAILED",
        "Subworkflow registry key must be a generated reference matching its immutable version.",
        { key, version: entry.version },
      );
    }
  }
  return registry;
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
    readonly parentWorkflowId: string;
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
  const childPrincipal = resolveChildPrincipal(
    node,
    parentPrincipal,
    entry.principal,
  );
  const mappedArgs = entry.mapArgs({
    inputs,
    context,
    principal: childPrincipal,
    policySnapshot,
  });
  assertJsonSafe(mappedArgs, `Subworkflow ${node.id} mapped invalid args.`);
  if (hasReservedWorkflowIdentityField(mappedArgs)) {
    throw subworkflowFailure(
      node,
      "mapped args cannot override reserved workflow identity fields",
    );
  }
  const childArgs = {
    ...mappedArgs,
    principal: childPrincipal,
    policySnapshot,
  };
  assertMappedArgsSize(node, childArgs);
  const projection: SubworkflowRunLinkProjection = {
    workspaceId: ownership.workspaceId,
    parentWorkflowId: ownership.parentWorkflowId,
    parentWorkflowVersion: ownership.parentWorkflowVersion,
    generation: ownership.generation,
    childWorkflow: node.workflow,
    childWorkflowVersion: node.childVersion,
    stepName: node.stepName,
    principal: childPrincipal,
    cancellation: entry.lifecycle.cancel,
    cleanup: entry.lifecycle.cleanup,
  };
  const reservation = await step.runMutation(
    entry.links.reserveRef,
    { projection, occurredAt: ownership.occurredAt },
    { name: `${node.stepName}.link.reserve.v1` },
  );
  const linkId = readLinkId(node, reservation);
  let childResult: unknown;
  let resultJson: string;
  try {
    const rawResult = await step.runWorkflow(entry.ref, childArgs, {
      name: node.stepName,
    });
    const decoded = Schema.decodeUnknownEither(entry.resultSchema)(rawResult);
    if (Either.isLeft(decoded)) {
      throw subworkflowFailure(
        node,
        "child returned an invalid declared result",
      );
    }
    childResult = decoded.right;
    const encoded = JSON.stringify(childResult);
    if (encoded === undefined) {
      throw subworkflowFailure(
        node,
        "child returned a non-serializable result",
      );
    }
    resultJson = encoded;
  } catch (error) {
    await reconcileLink(
      step,
      entry,
      node,
      ownership,
      linkId,
      isPinnedWorkflowCancellation(error)
        ? { kind: "canceled" }
        : { kind: "failed", error: "Child workflow failed." },
    );
    throw error;
  }
  await reconcileLink(step, entry, node, ownership, linkId, {
    kind: "succeeded",
    resultJson,
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

export const scheduledSubworkflowFinding = (
  node: unknown,
): string | undefined => {
  if (!isRecord(node) || node.kind !== "subworkflow" || !("schedule" in node)) {
    return undefined;
  }
  const nodeId = typeof node.id === "string" ? node.id : "unknown";
  return `subworkflow node ${nodeId} cannot use runAt or runAfter on pinned Workflow 0.4.4 because runWorkflow drops scheduled-child options; use a named sleep followed by an unscheduled child as a deliberately non-equivalent alternative, or a tested compatible upgrade`;
};

const decodePrincipal = (
  node: SubworkflowNodeV2,
  principal: unknown,
): WorkflowPrincipalType => {
  const decoded = Schema.decodeUnknownEither(WorkflowPrincipal)(principal);
  if (Either.isLeft(decoded)) {
    throw subworkflowFailure(node, "parent principal is invalid");
  }
  return decoded.right;
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

const readLinkId = (node: SubworkflowNodeV2, value: unknown): string => {
  if (
    !isRecord(value) ||
    typeof value.linkId !== "string" ||
    value.linkId.length === 0
  ) {
    throw subworkflowFailure(node, "link reservation returned an invalid ID");
  }
  return value.linkId;
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
