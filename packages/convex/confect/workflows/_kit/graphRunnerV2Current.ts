import { NonRetryableError } from "@convex-dev/workpool";
import * as ConfectRef from "@confect/core/Ref";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
import {
  evaluateSafeConditionExpression,
  type DurableWorkflowGraphV2,
  type WorkflowNodeV2,
} from "../graphCurrent";
import {
  deriveLogicalEffectKey,
  validateWorkflowEffectContract,
  type LogicalEffectKey,
  type WorkflowEffectContract,
} from "./effectReservations";
import type {
  DurableGraphStepOptions,
  DurableGraphStepRef,
  DurableGraphUnscheduledStepOptions,
  RunDurableGraphStep,
} from "./graphRunnerCurrent";
import {
  buildEdgeIndexes,
  findReadyWave,
  type TraversalSnapshot,
} from "./graphRunnerTraversal";
import {
  runRegisteredSubworkflow,
  runRegisteredBoundedSubworkflowBatch,
  type AnyWorkflowV2SubworkflowRegistryEntry,
} from "./subworkflowsCurrent";
import {
  runRegisteredWorkflowEvent,
  type AnyWorkflowV2EventRegistryEntry,
} from "./events";
import { assertInlineTransactionPreflight } from "./inlineTransactions";
import {
  runObservedWorkflowStage,
  type ObservedWorkflowStageRefs,
} from "./observedStageCurrent";
import {
  admitWorkflowPayloadReservation,
  assertWorkflowPayloadBudget,
  observeWorkflowPayload,
} from "./payloadBudget";
import {
  decodeWorkflowSettledFailure,
  declaredWorkflowFailureRoute,
  sameWorkflowSettledFailure,
  type WorkflowFailureRoute,
  type WorkflowSettledFailure,
} from "./failurePolicy";
import {
  assertWorkflowPrincipalAuthority,
  DurableWorkflowPrincipal,
  hasReservedWorkflowIdentityField,
} from "./principal";
import {
  compileWorkflowSchedule,
  type WorkflowScheduleOptions,
} from "./workflowSchedule";
import {
  buildWorkflowScheduledCapabilityInvocation,
  type WorkflowScheduledCapabilityRequest,
} from "./workflowScheduledCapability";

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

export const buildWorkflowCapabilityArgs = (
  envelope: WorkflowV2CapabilityEnvelope,
  mapped: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  if (hasReservedWorkflowIdentityField(mapped) || "policySnapshot" in mapped) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow capability args cannot override durable authority fields.",
    );
  }
  return {
    ...mapped,
    principal: envelope.principal,
    policySnapshot: envelope.policySnapshot,
  };
};

type CommonCapabilityEntryV2<Kind extends CapabilityKindV2> = {
  readonly kind: Kind;
  readonly ref: DurableGraphStepRef<Kind>;
  readonly effectClass: Kind extends "action" ? "external" | "none" : "none";
  readonly transactionPosture?: Kind extends "action" ? never : "small-atomic";
  readonly buildArgs: (
    envelope: WorkflowV2CapabilityEnvelope,
  ) => Record<string, unknown>;
};

export type WorkflowV2ActionCapabilityEntry =
  CommonCapabilityEntryV2<"action"> & {
    readonly effectContract: WorkflowEffectContract;
    readonly instanceKey: (envelope: WorkflowV2CapabilityEnvelope) => string;
    readonly terminalError?: (error: unknown) => string | undefined;
    readonly scheduled?: {
      /** Generated wrapper ref; never the external provider/action ref. */
      readonly ref: DurableGraphStepRef<"action">;
      readonly deadlineAt: (input: {
        readonly envelope: WorkflowV2CapabilityEnvelope & {
          readonly logicalEffectKey: LogicalEffectKey;
        };
        readonly request: Omit<
          WorkflowScheduledCapabilityRequest,
          "schemaVersion" | "deadlineAt"
        >;
      }) => number;
    };
    readonly authorization?: {
      readonly kind: "consequential";
      readonly requiredGrants: readonly string[];
      readonly boundary: "generated-current-authority";
    };
    readonly compensation?: Pick<
      CapabilityNodeV2,
      "payloadPolicy" | "semanticRuleIds"
    >;
  };

const generatedCurrentAuthorityBindingBrand = Symbol(
  "maestro.generated-current-authority-binding",
);
const generatedCurrentAuthorityBindings = new WeakSet<object>();

export type GeneratedCurrentAuthorityBinding = Readonly<{
  readonly ref: DurableGraphStepRef<"query">;
  readonly workflowContractKey: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly [generatedCurrentAuthorityBindingBrand]: true;
}>;

export const defineGeneratedCurrentAuthorityBinding = (
  graph: Pick<DurableWorkflowGraphV2, "id" | "version">,
  generatedWorkflowContractRefs: object,
): GeneratedCurrentAuthorityBinding => {
  const workflowContractKey = workflowContractKeyForGraph(graph.id);
  const functionNamespace = `workflowContracts/${workflowContractKey}`;
  const contract = Object.entries(generatedWorkflowContractRefs).find(
    ([key]) => key === workflowContractKey,
  )?.[1];
  if (
    typeof contract !== "object" ||
    contract === null ||
    !("authorizeConsequential" in contract) ||
    !isConfectRef(contract.authorizeConsequential) ||
    contract.authorizeConsequential.functionNamespace !== functionNamespace ||
    contract.authorizeConsequential.functionSpec.name !==
      "authorizeConsequential"
  ) {
    throw new Error("Generated workflow current authority is unavailable.");
  }
  const binding = Object.freeze({
    ref: ConfectRef.getFunctionReference(
      contract.authorizeConsequential,
    ) as DurableGraphStepRef<"query">,
    workflowContractKey,
    workflowId: graph.id,
    workflowVersion: graph.version,
    [generatedCurrentAuthorityBindingBrand]: true as const,
  });
  generatedCurrentAuthorityBindings.add(binding);
  return binding;
};

const isConfectRef = (value: unknown): value is ConfectRef.AnyQuery =>
  typeof value === "object" &&
  value !== null &&
  "functionNamespace" in value &&
  typeof value.functionNamespace === "string" &&
  "functionSpec" in value &&
  typeof value.functionSpec === "object" &&
  value.functionSpec !== null &&
  "name" in value.functionSpec &&
  typeof value.functionSpec.name === "string";

const workflowContractKeyForGraph = (workflowId: string): string => {
  const prefix = "workflow_";
  const source = workflowId.startsWith(prefix)
    ? workflowId.slice(prefix.length)
    : workflowId;
  const key = source.replace(/[-_]([A-Za-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
  if (!/^[a-z][A-Za-z0-9]*$/.test(key)) {
    throw new Error(
      "Generated workflow identity cannot resolve current authority.",
    );
  }
  return key;
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
  readonly convexVersion: string;
  readonly inputs: unknown;
  readonly principal: unknown;
  readonly policySnapshot: unknown;
  readonly currentAuthority?: GeneratedCurrentAuthorityBinding;
  readonly capabilityRegistry: Readonly<
    Record<string, WorkflowV2CapabilityEntry>
  >;
  readonly effectIdentity: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly generation: number;
    readonly occurredAt: number;
  };
  /** Deterministic workflow clock read immediately before scheduled dispatch. */
  readonly scheduleNowMs?: () => number;
  readonly observability?: ObservedWorkflowStageRefs;
  readonly subworkflowPolicy?: import("./subworkflowsCurrent").WorkflowV2SubworkflowPolicy;
  readonly admitEffect: (input: {
    readonly node: CapabilityNodeV2;
    readonly capability: string;
    readonly contract: WorkflowEffectContract;
    readonly logicalEffectKey: LogicalEffectKey;
  }) => Promise<WorkflowEffectAdmission>;
  readonly workflowRegistry?: Readonly<
    Record<string, AnyWorkflowV2SubworkflowRegistryEntry>
  >;
  readonly eventRegistry?: Readonly<
    Record<string, AnyWorkflowV2EventRegistryEntry>
  >;
  readonly projectOutput: (input: {
    readonly context: Readonly<Record<string, unknown>>;
  }) => Result;
};

export type WorkflowSettledFailureRoute = WorkflowFailureRoute;
export type { WorkflowSettledFailure };

class WorkflowCompensationFailure extends Error {
  readonly failure: WorkflowSettledFailure;
  readonly stepName: string;

  constructor(stepName: string, failure: WorkflowSettledFailure) {
    super(`Workflow compensation ${stepName} failed with ${failure.code}.`);
    this.name = "WorkflowCompensationFailure";
    this.failure = failure;
    this.stepName = stepName;
  }
}

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
  let predictedJournalBytes = 0;
  let observedJournalBytes = 0;
  for (const node of input.graph.nodes) {
    predictedJournalBytes = admitWorkflowPayloadReservation({
      nodeId: node.id,
      predictedJournalBytes,
      reservation:
        node.payloadPolicy.resultMode === "artifact-reference"
          ? { kind: "artifact-reference" }
          : {
              kind: "fixed",
              maxResultBytes: node.payloadPolicy.maxResultBytes,
            },
    }).predictedJournalBytes;
  }
  const failureRoutes = validateFailureRoutes(
    input.graph,
    edgeIndexes.outgoingByNode,
    input.capabilityRegistry,
  );
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
      wave.map((node) =>
        executeObservedNode(
          step,
          input,
          node,
          snapshot,
          input.graph.nodes.findIndex((candidate) => candidate.id === node.id),
        ),
      ),
    );
    const firstRejected = outcomes.find(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected",
    );
    if (firstRejected !== undefined) throw firstRejected.reason;
    let firstUnhandledFailure: unknown;
    let hasUnhandledFailure = false;
    const routedFailureNodeIds = new Set<string>();
    for (const [index, node] of wave.entries()) {
      const outcome = outcomes[index];
      if (outcome?.status === "fulfilled") {
        const settledFailure = decodeWorkflowSettledFailure(outcome.value);
        if (settledFailure !== undefined) {
          const route = failureRoutes.get(node.id);
          if (
            route === undefined ||
            !sameWorkflowSettledFailure(settledFailure, route.failure)
          ) {
            if (!hasUnhandledFailure) {
              firstUnhandledFailure = validationFailure(
                node,
                route === undefined
                  ? `returned typed failure ${settledFailure.code} without a declared route`
                  : `returned typed failure ${settledFailure.code} that does not match the declared route`,
              );
            }
            hasUnhandledFailure = true;
            continue;
          }
          observedJournalBytes = observeWorkflowPayload({
            nodeId: node.id,
            observedJournalBytes,
            value: route.failure,
          }).observedJournalBytes;
          context[node.id] = route.failure;
          completed.add(node.id);
          routedFailureNodeIds.add(node.id);
          passedEdges.add(route.edgeId);
          for (const edge of edgeIndexes.outgoingByNode.get(node.id) ?? []) {
            if (edge.id !== route.edgeId) failedEdges.add(edge.id);
          }
          continue;
        }
        observedJournalBytes = observeWorkflowPayload({
          nodeId: node.id,
          observedJournalBytes,
          value: outcome.value,
        }).observedJournalBytes;
        context[node.id] = outcome.value;
        completed.add(node.id);
      } else if (outcome?.status === "rejected") {
        if (!hasUnhandledFailure) firstUnhandledFailure = outcome.reason;
        hasUnhandledFailure = true;
      }
    }
    for (const [index, node] of wave.entries()) {
      const route = failureRoutes.get(node.id);
      if (
        outcomes[index]?.status === "fulfilled" &&
        routedFailureNodeIds.has(node.id) &&
        route?.kind === "compensation"
      ) {
        await runCompensation(step, input, node, route, context, completed);
      }
    }
    if (hasUnhandledFailure) throw firstUnhandledFailure;
    for (const [index, node] of wave.entries()) {
      if (
        outcomes[index]?.status !== "fulfilled" ||
        routedFailureNodeIds.has(node.id)
      )
        continue;
      for (const edge of edgeIndexes.outgoingByNode.get(node.id) ?? []) {
        if (failureRoutes.get(node.id)?.edgeId === edge.id) {
          failedEdges.add(edge.id);
          continue;
        }
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
      const result = input.projectOutput({ context });
      assertWorkflowPayloadBudget({
        surface: "product-projection",
        phase: "pre-product-projection",
        nodeId: "workflow-output",
        value: result,
      });
      return result;
    }
  }
};

const executeObservedNode = <Result extends Record<string, unknown>>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: WorkflowNodeV2,
  context: Readonly<Record<string, unknown>>,
  order: number,
) => {
  const capability =
    node.kind === "capability"
      ? input.capabilityRegistry[node.capability]
      : undefined;
  return runObservedWorkflowStage({
    step,
    ...(input.observability ? { refs: input.observability } : {}),
    workflowRunId: input.effectIdentity.workflowRunId,
    ...(step.workflowId ? { componentWorkflowId: step.workflowId } : {}),
    nodeId: node.id,
    label: node.label,
    kind: node.kind,
    stageKey: node.stepName,
    lifecycleGeneration: input.effectIdentity.generation,
    externalEffect:
      node.kind === "capability" &&
      node.functionKind === "action" &&
      capability?.kind === "action" &&
      capability.effectClass === "external",
    ...(!("schedule" in node) || node.schedule === undefined
      ? { observedAt: input.effectIdentity.occurredAt }
      : {}),
    order,
    run: () => executeNode(step, input, node, context),
  });
};

const validateFailureRoutes = (
  graph: DurableWorkflowGraphV2,
  outgoingByNode: ReadonlyMap<
    string,
    readonly DurableWorkflowGraphV2["edges"][number][]
  >,
  capabilityRegistry: Readonly<Record<string, WorkflowV2CapabilityEntry>>,
): ReadonlyMap<string, WorkflowSettledFailureRoute> => {
  const routes = new Map<string, WorkflowSettledFailureRoute>();
  for (const node of graph.nodes) {
    if (!("failurePolicy" in node)) continue;
    const route = declaredWorkflowFailureRoute(node.failurePolicy);
    if (route !== undefined) routes.set(node.id, route);
  }
  for (const [nodeId, route] of routes) {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    const edge = (outgoingByNode.get(nodeId) ?? []).find(
      (candidate) => candidate.id === route.edgeId,
    );
    if (!node || node.kind !== "capability" || !edge) {
      throw makePublicError(
        "VALIDATION_FAILED",
        `Workflow failure route ${nodeId} must name a capability node and an existing outgoing error edge.`,
        { nodeId, edgeId: route.edgeId },
      );
    }
    if (route.failure._tag !== "WorkflowSettledFailure") {
      throw validationFailure(
        node,
        "failure route must use the typed settled failure envelope",
      );
    }
    if (route.kind === "compensation") {
      for (const step of route.steps) {
        const compensation = capabilityRegistry[step.capability];
        if (
          compensation?.kind !== "action" ||
          compensation.compensation === undefined
        ) {
          throw validationFailure(
            node,
            `compensation ${step.stepName} requires an action registry entry with immutable compensation payload policy and semantic provenance`,
          );
        }
      }
    }
  }
  return routes;
};

const runCompensation = async <Result extends Record<string, unknown>>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: WorkflowNodeV2,
  route: Extract<WorkflowSettledFailureRoute, { kind: "compensation" }>,
  context: Readonly<Record<string, unknown>>,
  completed: ReadonlySet<string>,
): Promise<void> => {
  const eligible = route.steps.filter(({ forNodeId }) =>
    completed.has(forNodeId),
  );
  for (const [reverseIndex, compensationStep] of [...eligible]
    .reverse()
    .entries()) {
    const compensation = input.capabilityRegistry[compensationStep.capability];
    if (
      compensation?.kind !== "action" ||
      compensation.compensation === undefined
    ) {
      throw validationFailure(
        node,
        `compensation ${compensationStep.stepName} lost its immutable registry binding`,
      );
    }
    const compensationNode: Extract<
      CapabilityNodeV2,
      { functionKind: "action" }
    > = {
      id: `${node.id}.compensation.${reverseIndex}`,
      kind: "capability",
      functionKind: "action",
      capability: compensationStep.capability,
      label: `Compensate ${compensationStep.forNodeId}`,
      stepName: compensationStep.stepName,
      payloadPolicy: compensation.compensation.payloadPolicy,
      semanticRuleIds: compensation.compensation.semanticRuleIds,
      failurePolicy: { kind: "fail" },
    };
    const result = await runActionNode(
      step,
      input,
      compensationNode,
      compensation,
      {
        inputs: input.inputs,
        context,
        node: compensationNode,
        principal: input.principal,
        policySnapshot: input.policySnapshot,
      },
    );
    const settledFailure = decodeWorkflowSettledFailure(result);
    if (settledFailure !== undefined) {
      throw new WorkflowCompensationFailure(
        compensationStep.stepName,
        settledFailure,
      );
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
  if (node.kind === "bounded-subworkflow-batch") {
    const entry = input.workflowRegistry?.[node.workflow];
    if (!entry) {
      throw validationFailure(
        node,
        "missing generated workflow registry entry " + node.workflow,
      );
    }
    if (!step.workflowId) {
      throw validationFailure(
        node,
        "parent component identity is unavailable for bounded subworkflow linkage",
      );
    }
    return runRegisteredBoundedSubworkflowBatch({
      step,
      node,
      entry,
      inputs: input.inputs,
      context,
      principal: input.principal,
      policySnapshot: input.policySnapshot,
      ownership: {
        workspaceId: input.effectIdentity.workspaceId,
        parentWorkflowRunId: input.effectIdentity.workflowRunId,
        parentComponentWorkflowId: step.workflowId,
        parentWorkflowVersion: input.graph.version,
        generation: input.effectIdentity.generation,
        occurredAt: input.effectIdentity.occurredAt,
      },
    });
  }
  if (node.kind === "subworkflow") {
    const entry = input.workflowRegistry?.[node.workflow];
    if (!entry) {
      throw validationFailure(
        node,
        `missing generated workflow registry entry ${node.workflow}`,
      );
    }
    if (!step.workflowId) {
      throw validationFailure(
        node,
        "parent component identity is unavailable for subworkflow linkage",
      );
    }
    return runRegisteredSubworkflow({
      step,
      node,
      entry,
      inputs: input.inputs,
      context,
      principal: input.principal,
      policySnapshot: input.policySnapshot,
      ownership: {
        workspaceId: input.effectIdentity.workspaceId,
        parentWorkflowRunId: input.effectIdentity.workflowRunId,
        parentComponentWorkflowId: step.workflowId,
        parentWorkflowVersion: input.graph.version,
        generation: input.effectIdentity.generation,
        occurredAt: input.effectIdentity.occurredAt,
      },
    });
  }
  if (node.kind === "event") {
    const entry = input.eventRegistry?.[node.eventDefinition];
    if (!entry) {
      throw validationFailure(
        node,
        `missing generated event registry entry ${node.eventDefinition}`,
      );
    }
    return runRegisteredWorkflowEvent({
      step,
      node,
      entry,
      ownership: {
        workspaceId: input.effectIdentity.workspaceId,
        workflowRunId: input.effectIdentity.workflowRunId,
        principal: input.principal,
        occurredAt: input.effectIdentity.occurredAt,
      },
    });
  }
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
  assertCapabilityPrincipal(input, node);
  const envelope: WorkflowV2CapabilityEnvelope = {
    inputs: input.inputs,
    context,
    node,
    principal: input.principal,
    policySnapshot: input.policySnapshot,
  };
  if (node.functionKind === "query") {
    const options = capabilityStepOptions(input, node, entry);
    const args = entry.buildArgs(envelope);
    assertCapabilityArgs(node, args);
    const result = await step.runQuery(
      entry.ref as DurableGraphStepRef<"query">,
      args,
      options,
    );
    return assertCapabilityResult(node, result);
  }
  if (node.functionKind === "mutation") {
    const options = capabilityStepOptions(input, node, entry);
    const args = entry.buildArgs(envelope);
    assertCapabilityArgs(node, args);
    const result = await step.runMutation(
      entry.ref as DurableGraphStepRef<"mutation">,
      args,
      options,
    );
    return assertCapabilityResult(node, result);
  }
  return runActionNode(
    step,
    input,
    node as Extract<CapabilityNodeV2, { functionKind: "action" }>,
    entry as WorkflowV2ActionCapabilityEntry,
    envelope,
  );
};

const assertCapabilityPrincipal = <Result extends Record<string, unknown>>(
  input: RunDurableGraphV2CompilerInput<Result>,
  node: CapabilityNodeV2,
): void => {
  const candidate = input.principal as { readonly version?: unknown };
  if (candidate.version !== 2) return;
  const decoded = Schema.decodeUnknownExit(DurableWorkflowPrincipal)(
    input.principal,
  );
  if (Exit.isFailure(decoded)) {
    throw validationFailure(node, "durable workflow principal is invalid");
  }
  try {
    assertWorkflowPrincipalAuthority(decoded.value, {
      workspaceId: input.effectIdentity.workspaceId,
      requiredGrants: [],
    });
  } catch {
    throw validationFailure(node, "durable workflow principal is unavailable");
  }
};

const capabilityStepOptions = <Result extends Record<string, unknown>>(
  input: RunDurableGraphV2CompilerInput<Result>,
  node: Extract<CapabilityNodeV2, { functionKind: "query" | "mutation" }>,
  entry: WorkflowV2CapabilityEntry,
): DurableGraphStepOptions | DurableGraphUnscheduledStepOptions => {
  if (node.transaction.kind === "independent") {
    return {
      name: node.stepName,
      ...compileScheduledStep(input, node).options,
    };
  }
  assertInlineTransactionPreflight({
    convexVersion: input.convexVersion,
    transaction: node.transaction,
    capabilityPosture: entry.transactionPosture,
  });
  return {
    name: node.stepName,
    inline: true,
    transactionLimits: node.transaction.limits,
  };
};

const runActionNode = async <Result extends Record<string, unknown>>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: Extract<CapabilityNodeV2, { functionKind: "action" }>,
  entry: WorkflowV2ActionCapabilityEntry,
  envelope: WorkflowV2CapabilityEnvelope,
): Promise<unknown> => {
  const compiledSchedule = compileScheduledStep(input, node);
  const authorization = assertExternalAuthorizationBoundary(input, node, entry);
  const validated = validateWorkflowEffectContract(
    entry.effectContract,
    node.retry,
  );
  if (Result.isFailure(validated)) {
    throw validationFailure(
      node,
      `capability ${node.capability} requires a repair to its retry/idempotency declaration: ${validated.failure.issue}`,
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
  const capabilityEnvelope = { ...envelope, logicalEffectKey };
  const args = entry.buildArgs(capabilityEnvelope);
  assertCapabilityArgs(node, args);
  if (
    validated.success.strategy === "provider-native" &&
    readArgumentPath(args, validated.success.keyArgumentPath) !==
      logicalEffectKey
  ) {
    throw validationFailure(
      node,
      `capability ${node.capability} must map the derived logical effect key at ${validated.success.keyArgumentPath}`,
    );
  }
  let dispatchRef = entry.ref;
  let dispatchArgs = args;
  if (compiledSchedule.request !== undefined) {
    if (entry.scheduled === undefined) {
      throw validationFailure(
        node,
        `scheduled action ${node.capability} requires a generated scheduled wrapper binding`,
      );
    }
    const deadlineAt = entry.scheduled.deadlineAt({
      envelope: capabilityEnvelope,
      request: compiledSchedule.request,
    });
    try {
      dispatchArgs = {
        invocation: buildWorkflowScheduledCapabilityInvocation({
          requestedAt: compiledSchedule.request.requestedAt,
          requestedSchedule: compiledSchedule.request.requestedSchedule,
          deadlineAt,
          principal: input.principal,
          policySnapshot: input.policySnapshot,
          delegateArgs: args,
        }),
      };
    } catch (error) {
      throw validationFailure(
        node,
        error instanceof Error ? error.message : "invalid scheduled wrapper",
      );
    }
    assertCapabilityArgs(node, dispatchArgs);
    dispatchRef = entry.scheduled.ref;
  }
  if (authorization) {
    await reauthorizeExternalAction(step, input, node, authorization);
  }
  const admission = await input.admitEffect({
    node,
    capability: node.capability,
    contract: validated.success,
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
        validated.success.strategy !== "provider-native" ||
        validated.success.ambiguityResolution.kind !==
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
        validated.success.ambiguityResolution.capabilityRef,
      );
    }
    if (admission.kind === "reconcile-ledger") {
      if (validated.success.strategy !== "durable-ledger-and-reconcile") {
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
        validated.success.reconciliationCapabilityRef,
      );
    }
    return admission.result;
  }
  if (
    admission.kind === "replay-provider-key" &&
    (validated.success.strategy !== "provider-native" ||
      validated.success.ambiguityResolution.kind !==
        "exact-provider-key-replay")
  ) {
    throw validationFailure(
      node,
      `capability ${node.capability} cannot replay without an exact provider-key contract`,
    );
  }
  const options = {
    name: node.stepName,
    retry:
      validated.success.strategy === "non-retriable" || node.retry === undefined
        ? false
        : node.retry,
    ...compiledSchedule.options,
  } as const;
  try {
    const result = await step.runAction(dispatchRef, dispatchArgs, options);
    return assertCapabilityResult(node, result);
  } catch (error) {
    const terminalMessage = entry.terminalError?.(error);
    if (terminalMessage !== undefined) {
      throw new NonRetryableError(terminalMessage);
    }
    throw error;
  }
};

type CompiledScheduledStep = {
  readonly options:
    WorkflowScheduleOptions | DurableGraphUnscheduledStepOptions;
  readonly request?: Omit<
    WorkflowScheduledCapabilityRequest,
    "schemaVersion" | "deadlineAt"
  >;
};
const compileScheduledStep = <Result extends Record<string, unknown>>(
  input: RunDurableGraphV2CompilerInput<Result>,
  node: WorkflowNodeV2,
): CompiledScheduledStep => {
  if (!("schedule" in node) || node.schedule === undefined) {
    return { options: {} };
  }
  const requestedAt = input.scheduleNowMs?.() ?? Date.now();
  const result = compileWorkflowSchedule(node.schedule, requestedAt);
  if (Result.isFailure(result)) {
    throw validationFailure(
      node,
      `${result.failure.code}: ${result.failure.message}`,
    );
  }
  const requestedStartAt =
    node.schedule.kind === "runAt"
      ? node.schedule.timestamp
      : requestedAt + node.schedule.delayMs;
  return {
    options: result.success,
    request: {
      requestedAt,
      requestedSchedule: node.schedule,
      requestedStartAt,
    },
  };
};

const assertExternalAuthorizationBoundary = <
  Result extends Record<string, unknown>,
>(
  input: RunDurableGraphV2CompilerInput<Result>,
  node: Extract<CapabilityNodeV2, { functionKind: "action" }>,
  entry: WorkflowV2ActionCapabilityEntry,
): WorkflowV2ActionCapabilityEntry["authorization"] => {
  const principal = input.principal as { readonly version?: unknown };
  if (entry.effectClass !== "external") return undefined;
  if (principal.version !== 2) {
    throw validationFailure(node, "workflow authority is unavailable");
  }
  if (
    entry.authorization?.kind !== "consequential" ||
    entry.authorization.boundary !== "generated-current-authority" ||
    entry.authorization.requiredGrants.length === 0 ||
    !isGeneratedCurrentAuthorityBinding(input.currentAuthority, input.graph)
  ) {
    throw validationFailure(
      node,
      "V2 external capabilities require generated current-authority reauthorization",
    );
  }
  return entry.authorization;
};

const reauthorizeExternalAction = async <
  Result extends Record<string, unknown>,
>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: Extract<CapabilityNodeV2, { functionKind: "action" }>,
  authorization: NonNullable<WorkflowV2ActionCapabilityEntry["authorization"]>,
): Promise<void> => {
  try {
    const currentAuthority = input.currentAuthority;
    if (!isGeneratedCurrentAuthorityBinding(currentAuthority, input.graph)) {
      throw new Error("Generated current authority is unavailable.");
    }
    const result = await step.runQuery(
      currentAuthority.ref,
      {
        workspaceId: input.effectIdentity.workspaceId,
        principal: input.principal,
        requiredGrants: authorization.requiredGrants,
        capability: node.capability,
        workflowId: input.graph.id,
        workflowVersion: input.graph.version,
      },
      { name: `${node.stepName}.authorize` },
    );
    assertCurrentAuthorityReceipt(result, input, node, authorization);
  } catch {
    throw validationFailure(node, "workflow authority is unavailable");
  }
};

const isGeneratedCurrentAuthorityBinding = (
  value: unknown,
  graph: Pick<DurableWorkflowGraphV2, "id" | "version">,
): value is GeneratedCurrentAuthorityBinding => {
  if (
    typeof value !== "object" ||
    value === null ||
    !generatedCurrentAuthorityBindings.has(value) ||
    !(generatedCurrentAuthorityBindingBrand in value) ||
    value[generatedCurrentAuthorityBindingBrand] !== true ||
    !("ref" in value) ||
    !("workflowId" in value) ||
    value.workflowId !== graph.id ||
    !("workflowContractKey" in value) ||
    value.workflowContractKey !== workflowContractKeyForGraph(graph.id) ||
    !("workflowVersion" in value) ||
    value.workflowVersion !== graph.version
  ) {
    return false;
  }
  return true;
};

const assertCurrentAuthorityReceipt = <Result extends Record<string, unknown>>(
  result: unknown,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: Extract<CapabilityNodeV2, { functionKind: "action" }>,
  authorization: NonNullable<WorkflowV2ActionCapabilityEntry["authorization"]>,
): void => {
  const principal = input.principal as {
    readonly kind?: unknown;
    readonly actorId?: unknown;
    readonly authEpoch?: unknown;
  };
  if (
    typeof result !== "object" ||
    result === null ||
    !("kind" in result) ||
    result.kind !== "workflow-current-authority" ||
    !("version" in result) ||
    result.version !== 1 ||
    !("workspaceId" in result) ||
    result.workspaceId !== input.effectIdentity.workspaceId ||
    principal.kind !== "user" ||
    !("actorId" in result) ||
    result.actorId !== principal.actorId ||
    !("authEpoch" in result) ||
    typeof result.authEpoch !== "number" ||
    typeof principal.authEpoch !== "number" ||
    result.authEpoch < principal.authEpoch ||
    !("capability" in result) ||
    result.capability !== node.capability ||
    !("workflowId" in result) ||
    result.workflowId !== input.graph.id ||
    !("workflowVersion" in result) ||
    result.workflowVersion !== input.graph.version ||
    !("requiredGrants" in result) ||
    !sameStrings(result.requiredGrants, authorization.requiredGrants)
  ) {
    throw new Error("Generated current authority receipt is invalid.");
  }
};

const sameStrings = (left: unknown, right: readonly string[]): boolean =>
  Array.isArray(left) &&
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const assertCapabilityArgs = (
  node: CapabilityNodeV2,
  args: Record<string, unknown>,
): void => {
  const measurement = assertWorkflowPayloadBudget({
    surface: "step-args",
    phase: "pre-dispatch",
    nodeId: node.id,
    value: args,
  });
  if (measurement.measuredBytes > node.payloadPolicy.maxInputBytes) {
    throw validationFailure(node, "capability arguments exceed maxInputBytes");
  }
};

const assertCapabilityResult = (
  node: CapabilityNodeV2,
  result: unknown,
): unknown => {
  const measurement = assertWorkflowPayloadBudget({
    surface: "step-result",
    phase: "pre-component-return",
    nodeId: node.id,
    value: result,
  });
  if (
    node.payloadPolicy.resultMode === "inline" &&
    measurement.measuredBytes > node.payloadPolicy.maxResultBytes
  ) {
    throw validationFailure(node, "capability result exceeds maxResultBytes");
  }
  if (
    node.payloadPolicy.resultMode === "artifact-reference" &&
    !isArtifactReference(result)
  ) {
    throw validationFailure(
      node,
      "capability must return an artifact reference",
    );
  }
  return result;
};

const isArtifactReference = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "artifactId" in value &&
  typeof value.artifactId === "string" &&
  value.artifactId.length > 0;

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
