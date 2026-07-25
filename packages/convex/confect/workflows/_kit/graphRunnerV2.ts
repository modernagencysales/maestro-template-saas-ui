import { NonRetryableError } from "@convex-dev/workpool";
import * as ConfectRef from "@confect/core/Ref";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
import {
  evaluateSafeConditionExpression,
  type DurableWorkflowGraphV2,
  type WorkflowCapabilityReference,
  type WorkflowNodeV2,
  type WorkflowStepName,
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
import {
  runRegisteredSubworkflow,
  type AnyWorkflowV2SubworkflowRegistryEntry,
} from "./subworkflows";
import {
  runRegisteredWorkflowEvent,
  type AnyWorkflowV2EventRegistryEntry,
} from "./events";
import { assertInlineTransactionPreflight } from "./inlineTransactions";
import {
  runObservedWorkflowStage,
  type ObservedWorkflowStageRefs,
} from "./observedStage";
import {
  admitWorkflowPayloadReservation,
  assertWorkflowPayloadBudget,
  observeWorkflowPayload,
} from "./payloadBudget";
import {
  assertWorkflowPrincipalAuthority,
  DurableWorkflowPrincipal,
  hasReservedWorkflowIdentityField,
} from "./principal";

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
    readonly authorization?: {
      readonly kind: "consequential";
      readonly requiredGrants: readonly string[];
      readonly boundary: "generated-current-authority";
    };
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
  readonly observability?: ObservedWorkflowStageRefs;
  readonly subworkflowPolicy?: import("./subworkflows").WorkflowV2SubworkflowPolicy;
  readonly admitEffect: (input: {
    readonly node: CapabilityNodeV2;
    readonly capability: string;
    readonly contract: WorkflowEffectContract;
    readonly logicalEffectKey: LogicalEffectKey;
  }) => Promise<WorkflowEffectAdmission>;
  readonly failureRoutes?: Readonly<
    Record<string, WorkflowSettledFailureRoute>
  >;
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

export type WorkflowSettledFailure = {
  readonly _tag: "WorkflowSettledFailure";
  readonly code: string;
  readonly message: string;
};

export type WorkflowSettledFailureRoute =
  | {
      readonly kind: "error-edge";
      readonly edgeId: string;
      readonly failure: WorkflowSettledFailure;
    }
  | {
      readonly kind: "compensation";
      readonly edgeId: string;
      readonly capability: WorkflowCapabilityReference;
      readonly stepName: WorkflowStepName;
      readonly failure: WorkflowSettledFailure;
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
    input,
    edgeIndexes.outgoingByNode,
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
    let firstUnhandledFailure: unknown;
    let hasUnhandledFailure = false;
    for (const [index, node] of wave.entries()) {
      const outcome = outcomes[index];
      if (outcome?.status === "fulfilled") {
        observedJournalBytes = observeWorkflowPayload({
          nodeId: node.id,
          observedJournalBytes,
          value: outcome.value,
        }).observedJournalBytes;
        context[node.id] = outcome.value;
        completed.add(node.id);
      } else if (outcome?.status === "rejected") {
        const route = failureRoutes.get(node.id);
        if (route === undefined) {
          if (!hasUnhandledFailure) firstUnhandledFailure = outcome.reason;
          hasUnhandledFailure = true;
          continue;
        }
        context[node.id] = route.failure;
        completed.add(node.id);
        passedEdges.add(route.edgeId);
        for (const edge of edgeIndexes.outgoingByNode.get(node.id) ?? []) {
          if (edge.id !== route.edgeId) failedEdges.add(edge.id);
        }
      }
    }
    for (const [index, node] of wave.entries()) {
      const route = failureRoutes.get(node.id);
      if (
        outcomes[index]?.status === "rejected" &&
        route?.kind === "compensation"
      ) {
        await runCompensation(step, input, node, route, context);
      }
    }
    if (hasUnhandledFailure) throw firstUnhandledFailure;
    for (const [index, node] of wave.entries()) {
      if (outcomes[index]?.status !== "fulfilled") continue;
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
    observedAt: input.effectIdentity.occurredAt,
    order,
    run: () => executeNode(step, input, node, context),
  });
};

const validateFailureRoutes = <Result extends Record<string, unknown>>(
  input: RunDurableGraphV2CompilerInput<Result>,
  outgoingByNode: ReadonlyMap<
    string,
    readonly DurableWorkflowGraphV2["edges"][number][]
  >,
): ReadonlyMap<string, WorkflowSettledFailureRoute> => {
  const routes = new Map(Object.entries(input.failureRoutes ?? {}));
  for (const [nodeId, route] of routes) {
    const node = input.graph.nodes.find((candidate) => candidate.id === nodeId);
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
  }
  return routes;
};

const runCompensation = async <Result extends Record<string, unknown>>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: WorkflowNodeV2,
  route: Extract<WorkflowSettledFailureRoute, { kind: "compensation" }>,
  context: Readonly<Record<string, unknown>>,
): Promise<void> => {
  const compensation = input.capabilityRegistry[route.capability];
  if (compensation?.kind !== "action") {
    throw validationFailure(
      node,
      `missing generated action registry entry for compensation capability ${route.capability}`,
    );
  }
  const compensationNode: Extract<
    CapabilityNodeV2,
    { functionKind: "action" }
  > = {
    id: `${node.id}.compensation`,
    kind: "capability",
    functionKind: "action",
    capability: route.capability,
    label: `Compensate ${node.label}`,
    stepName: route.stepName,
    payloadPolicy: node.payloadPolicy,
    semanticRuleIds: node.semanticRuleIds,
  };
  await runActionNode(step, input, compensationNode, compensation, {
    inputs: input.inputs,
    context,
    node: compensationNode,
    principal: input.principal,
    policySnapshot: input.policySnapshot,
  });
};

const executeNode = async <Result extends Record<string, unknown>>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2CompilerInput<Result>,
  node: WorkflowNodeV2,
  context: Readonly<Record<string, unknown>>,
): Promise<unknown> => {
  if (node.kind === "source") return input.inputs;
  if (node.kind === "output") return input.projectOutput({ context });
  if (node.kind === "subworkflow") {
    const entry = input.workflowRegistry?.[node.workflow];
    if (!entry) {
      throw validationFailure(
        node,
        `missing generated workflow registry entry ${node.workflow}`,
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
        parentWorkflowId: input.effectIdentity.workflowRunId,
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
  const decoded = Schema.decodeUnknownEither(DurableWorkflowPrincipal)(
    input.principal,
  );
  if (Either.isLeft(decoded)) {
    throw validationFailure(node, "durable workflow principal is invalid");
  }
  try {
    assertWorkflowPrincipalAuthority(decoded.right, {
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
): Readonly<Record<string, unknown>> => {
  if (node.transaction.kind === "independent") {
    return { name: node.stepName };
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
  const authorization = assertExternalAuthorizationBoundary(input, node, entry);
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
  if (authorization) {
    await reauthorizeExternalAction(step, input, node, authorization);
  }
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
  assertCapabilityArgs(node, args);
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
    const result = await step.runAction(entry.ref, args, options);
    return assertCapabilityResult(node, result);
  } catch (error) {
    const terminalMessage = entry.terminalError?.(error);
    if (terminalMessage !== undefined) {
      throw new NonRetryableError(terminalMessage);
    }
    throw error;
  }
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
