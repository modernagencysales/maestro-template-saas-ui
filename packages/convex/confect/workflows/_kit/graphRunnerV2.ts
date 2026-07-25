import { NonRetryableError } from "@convex-dev/workpool";
import * as Either from "effect/Either";

import { makePublicError } from "../../shared/errors";
import {
  evaluateSafeConditionExpression,
  type DurableWorkflowGraphV2,
  type WorkflowNodeV2,
} from "../graph";
import {
  deriveLogicalEffectKey,
  validateWorkflowEffectContract,
  type LogicalEffectKey,
  type WorkflowEffectContract,
} from "./effectReservations";
import type { DurableGraphStepRef, RunDurableGraphStep } from "./graphRunner";
import {
  buildEdgeIndexes,
  findReadyWave,
  type TraversalSnapshot,
} from "./graphRunnerTraversal";

type CapabilityNodeV2 = Extract<WorkflowNodeV2, { kind: "capability" }>;
type CapabilityKindV2 = CapabilityNodeV2["functionKind"];

export type WorkflowV2CapabilityEnvelope = {
  readonly inputs: unknown;
  readonly context: Readonly<Record<string, unknown>>;
  readonly node: CapabilityNodeV2;
  readonly principal: unknown;
  readonly policySnapshot: unknown;
  readonly logicalEffectKey?: LogicalEffectKey;
};

type CommonCapabilityEntryV2<Kind extends CapabilityKindV2> = {
  readonly kind: Kind;
  readonly ref: DurableGraphStepRef<Kind>;
  readonly effectClass: Kind extends "action" ? "external" | "none" : "none";
  readonly buildArgs: (
    envelope: WorkflowV2CapabilityEnvelope,
  ) => Record<string, unknown>;
};

export type WorkflowV2ActionCapabilityEntry =
  CommonCapabilityEntryV2<"action"> & {
    readonly effectContract: WorkflowEffectContract;
    readonly instanceKey: (envelope: WorkflowV2CapabilityEnvelope) => string;
    readonly terminalError?: (error: unknown) => string | undefined;
  };

export type WorkflowV2CapabilityEntry =
  | WorkflowV2ActionCapabilityEntry
  | CommonCapabilityEntryV2<"query">
  | CommonCapabilityEntryV2<"mutation">;

export const defineWorkflowCapabilityRegistry = <
  const Registry extends Readonly<Record<string, WorkflowV2CapabilityEntry>>,
>(
  registry: Registry,
): Registry => registry;

export type WorkflowEffectAdmission =
  | { readonly kind: "dispatch" }
  | { readonly kind: "replay-provider-key" }
  | { readonly kind: "reuse"; readonly result: unknown }
  | { readonly kind: "reconcile-ledger" }
  | { readonly kind: "reconcile-provider-status" }
  | { readonly kind: "manual-review"; readonly result: unknown }
  | { readonly kind: "deny"; readonly reason: string };

export type RunDurableGraphV2CompilerInput<
  Result extends Record<string, unknown>,
> = {
  readonly graph: DurableWorkflowGraphV2;
  readonly inputs: unknown;
  readonly principal: unknown;
  readonly policySnapshot: unknown;
  readonly capabilityRegistry: Readonly<
    Record<string, WorkflowV2CapabilityEntry>
  >;
  readonly effectIdentity: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly generation: number;
  };
  readonly admitEffect: (input: {
    readonly node: CapabilityNodeV2;
    readonly capability: string;
    readonly contract: WorkflowEffectContract;
    readonly logicalEffectKey: LogicalEffectKey;
  }) => Promise<WorkflowEffectAdmission>;
  readonly projectOutput: (input: {
    readonly context: Readonly<Record<string, unknown>>;
  }) => Result;
};

export const runCompiledDurableGraphWorkflowV2 = async <
  Result extends Record<string, unknown>,
>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
): Promise<Result> => {
  const edgeIndexes = buildEdgeIndexes(input.graph.edges);
  const context: Record<string, unknown> = {};
  const completed = new Set<string>();
  const passedEdges = new Set<string>();
  const failedEdges = new Set<string>();
  const traversal: TraversalSnapshot = {
    incomingByNode: edgeIndexes.incomingByNode,
    joinsByNode: new Map(input.graph.joins.map((join) => [join.nodeId, join])),
    completedNodes: completed,
    passedEdges,
    failedEdges,
  };
  while (true) {
    const wave = findReadyWave(input.graph.nodes, traversal);
    if (wave.length === 0) {
      throw makePublicError(
        "VALIDATION_FAILED",
        "Workflow graph V2 traversal made no progress.",
      );
    }
    const inlineMutations = wave.filter(
      (node) =>
        node.kind === "capability" &&
        node.functionKind === "mutation" &&
        node.transaction.kind === "inline",
    );
    if (inlineMutations.length > 1) {
      const firstInlineMutation = inlineMutations[0];
      if (firstInlineMutation === undefined) {
        throw makePublicError(
          "VALIDATION_FAILED",
          "Invalid inline mutation wave.",
        );
      }
      throw validationFailure(
        firstInlineMutation,
        `ready wave contains ${inlineMutations.length} inline mutations; combine atomic writes behind one typed capability or make them independent`,
      );
    }
    const snapshot = { ...context };
    const outcomes = await Promise.allSettled(
      wave.map((node) => executeNode(step, input, node, snapshot)),
    );
    for (const [index, node] of wave.entries()) {
      const outcome = outcomes[index];
      if (outcome?.status === "fulfilled") {
        context[node.id] = outcome.value;
        completed.add(node.id);
      }
    }
    const failure = outcomes.find(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected",
    );
    if (failure) throw failure.reason;
    for (const node of wave) {
      for (const edge of edgeIndexes.outgoingByNode.get(node.id) ?? []) {
        const active = edge.condition
          ? evaluateSafeConditionExpression(edge.condition.expression, {
              inputs: input.inputs,
              context,
              policySnapshot: input.policySnapshot,
            })
          : true;
        (active ? passedEdges : failedEdges).add(edge.id);
      }
    }
    if (wave.some((node) => node.kind === "output")) {
      return input.projectOutput({ context });
    }
  }
};

const executeNode = async <Result extends Record<string, unknown>>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: WorkflowNodeV2,
  context: Readonly<Record<string, unknown>>,
): Promise<unknown> => {
  if (node.kind === "source") return input.inputs;
  if (node.kind === "output") return input.projectOutput({ context });
  if (node.kind !== "capability") {
    throw validationFailure(node, "node compiler is not enabled yet");
  }
  const entry = input.capabilityRegistry[node.capability];
  if (entry === undefined) {
    throw validationFailure(
      node,
      `missing capability registry entry ${node.capability}`,
    );
  }
  if (entry.kind !== node.functionKind) {
    throw validationFailure(
      node,
      `capability ${node.capability} declares ${entry.kind}, not ${node.functionKind}`,
    );
  }
  const envelope: WorkflowV2CapabilityEnvelope = {
    inputs: input.inputs,
    context,
    node,
    principal: input.principal,
    policySnapshot: input.policySnapshot,
  };
  if (node.functionKind === "query") {
    return step.runQuery(
      entry.ref as DurableGraphStepRef<"query">,
      entry.buildArgs(envelope),
      {
        name: node.stepName,
      },
    );
  }
  if (node.functionKind === "mutation") {
    return step.runMutation(
      entry.ref as DurableGraphStepRef<"mutation">,
      entry.buildArgs(envelope),
      { name: node.stepName },
    );
  }
  return runActionNode(
    step,
    input,
    node as Extract<CapabilityNodeV2, { functionKind: "action" }>,
    entry as WorkflowV2ActionCapabilityEntry,
    envelope,
  );
};

const runActionNode = async <Result extends Record<string, unknown>>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: Extract<CapabilityNodeV2, { functionKind: "action" }>,
  entry: WorkflowV2ActionCapabilityEntry,
  envelope: WorkflowV2CapabilityEnvelope,
): Promise<unknown> => {
  const validated = validateWorkflowEffectContract(
    entry.effectContract,
    node.retry,
  );
  if (Either.isLeft(validated)) {
    throw validationFailure(
      node,
      `capability ${node.capability} requires a repair to its retry/idempotency declaration: ${validated.left.issue}`,
    );
  }
  const instanceKey = entry.instanceKey(envelope);
  if (instanceKey.length === 0) {
    throw validationFailure(
      node,
      `capability ${node.capability} produced an empty effect instance key`,
    );
  }
  const logicalEffectKey = deriveLogicalEffectKey({
    ...input.effectIdentity,
    workflowVersion: input.graph.version,
    stepName: node.stepName,
    instanceKey,
  });
  const admission = await input.admitEffect({
    node,
    capability: node.capability,
    contract: validated.right,
    logicalEffectKey,
  });
  if (
    admission.kind !== "dispatch" &&
    admission.kind !== "replay-provider-key"
  ) {
    if (admission.kind === "deny") {
      throw validationFailure(
        node,
        `effect admission denied: ${admission.reason}`,
      );
    }
    if (admission.kind === "reconcile-provider-status") {
      if (
        validated.right.strategy !== "provider-native" ||
        validated.right.ambiguityResolution.kind !==
          "provider-status-reconciliation"
      ) {
        throw validationFailure(
          node,
          `capability ${node.capability} has no declared provider-status reconciliation mechanism`,
        );
      }
      return runReconciliationCapability(
        step,
        input,
        node,
        envelope,
        logicalEffectKey,
        validated.right.ambiguityResolution.capabilityRef,
      );
    }
    if (admission.kind === "reconcile-ledger") {
      if (validated.right.strategy !== "durable-ledger-and-reconcile") {
        throw validationFailure(
          node,
          `capability ${node.capability} has no declared durable-ledger reconciliation mechanism`,
        );
      }
      return runReconciliationCapability(
        step,
        input,
        node,
        envelope,
        logicalEffectKey,
        validated.right.reconciliationCapabilityRef,
      );
    }
    return admission.result;
  }
  if (
    admission.kind === "replay-provider-key" &&
    (validated.right.strategy !== "provider-native" ||
      validated.right.ambiguityResolution.kind !== "exact-provider-key-replay")
  ) {
    throw validationFailure(
      node,
      `capability ${node.capability} cannot replay without an exact provider-key contract`,
    );
  }
  const args = entry.buildArgs({ ...envelope, logicalEffectKey });
  if (
    validated.right.strategy === "provider-native" &&
    readArgumentPath(args, validated.right.keyArgumentPath) !== logicalEffectKey
  ) {
    throw validationFailure(
      node,
      `capability ${node.capability} must map the derived logical effect key at ${validated.right.keyArgumentPath}`,
    );
  }
  const options = {
    name: node.stepName,
    retry:
      validated.right.strategy === "non-retriable" || node.retry === undefined
        ? false
        : node.retry,
  } as const;
  try {
    return await step.runAction(entry.ref, args, options);
  } catch (error) {
    const terminalMessage = entry.terminalError?.(error);
    if (terminalMessage !== undefined) {
      throw new NonRetryableError(terminalMessage);
    }
    throw error;
  }
};

const readArgumentPath = (
  args: Readonly<Record<string, unknown>>,
  path: string,
): unknown => {
  let current: unknown = args;
  for (const segment of path.split(".")) {
    if (
      typeof current !== "object" ||
      current === null ||
      !Object.hasOwn(current, segment)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const runReconciliationCapability = <Result extends Record<string, unknown>>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: Extract<CapabilityNodeV2, { functionKind: "action" }>,
  envelope: WorkflowV2CapabilityEnvelope,
  logicalEffectKey: LogicalEffectKey,
  capabilityRef: string,
): Promise<unknown> => {
  const reconciliation = input.capabilityRegistry[capabilityRef];
  if (reconciliation?.kind !== "action") {
    throw validationFailure(
      node,
      `missing generated action registry entry for reconciliation capability ${capabilityRef}`,
    );
  }
  return step.runAction(
    reconciliation.ref,
    reconciliation.buildArgs({ ...envelope, logicalEffectKey }),
    { name: `${node.stepName}.reconcile`, retry: false },
  );
};

const validationFailure = (
  node: Pick<WorkflowNodeV2, "id" | "stepName">,
  issue: string,
) =>
  makePublicError(
    "VALIDATION_FAILED",
    `Workflow graph V2 compilation failed at ${node.id} (${node.stepName}): ${issue}`,
    { nodeId: node.id, stepName: node.stepName, issue },
  );
