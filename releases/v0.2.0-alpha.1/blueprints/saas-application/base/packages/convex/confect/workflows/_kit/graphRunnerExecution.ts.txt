import { makePublicError } from "../../shared/errors";
import {
  validateWorkflowGraph,
  type DurableWorkflowGraph,
  type WorkflowNode,
} from "../graph";
import { assertJsonObject, assertJsonSafe } from "./graphRunnerJson";
import { executeNode, isEdgeActive } from "./graphRunnerNodes";
import {
  buildEdgeIndexes,
  findBlockedReachableNodeIds,
  findReachableNodeIds,
  isNodeReady,
  type TraversalSnapshot,
} from "./graphRunnerTraversal";
import { runObservedWorkflowStage } from "./observedStage";
import type { RunDurableGraphInput, RunDurableGraphStep } from "./graphRunner";
import {
  assertWorkflowPayloadBudget,
  observeWorkflowPayload,
} from "./payloadBudget";

type GraphExecutionState = Omit<
  TraversalSnapshot,
  "completedNodes" | "passedEdges" | "failedEdges"
> & {
  readonly input: RunDurableGraphInput;
  readonly nodesById: ReadonlyMap<string, WorkflowNode>;
  readonly outgoingByNode: ReadonlyMap<string, readonly WorkflowNodeEdge[]>;
  readonly reachableNodeIds: ReadonlySet<string>;
  readonly context: Record<string, unknown>;
  readonly completedNodes: Set<string>;
  readonly passedEdges: Set<string>;
  readonly failedEdges: Set<string>;
  readonly queuedNodes: Set<string>;
  readonly queue: string[];
  readonly graphOrder: ReadonlyMap<string, number>;
  observedJournalBytes: number;
  order: number;
};

type WorkflowNodeEdge = DurableWorkflowGraph["edges"][number];

type ProcessNodeOutcome =
  | { readonly type: "continue" }
  | {
      readonly type: "output";
      readonly value: Readonly<Record<string, unknown>>;
    };

export const validateGraphOrThrow = (graph: DurableWorkflowGraph): void => {
  const validationErrors = validateWorkflowGraph(graph);
  if (validationErrors.length === 0) {
    return;
  }
  throw makePublicError("VALIDATION_FAILED", "Workflow graph is invalid.", {
    errorCount: validationErrors.length,
  });
};

export const readStartNode = (graph: DurableWorkflowGraph): WorkflowNode => {
  const startNode = graph.nodes.find((node) => node.id === graph.startNodeId);
  if (!startNode) {
    throw makePublicError("VALIDATION_FAILED", "Workflow graph is invalid.");
  }
  return startNode;
};

export const runGraphExecution = async (
  step: RunDurableGraphStep,
  input: RunDurableGraphInput,
  startNode: WorkflowNode,
): Promise<Readonly<Record<string, unknown>>> => {
  const state = createExecutionState(input, startNode);

  while (state.queue.length > 0) {
    const outcome = await processReadyWave(step, state);
    if (outcome.type === "output") {
      return outcome.value;
    }
  }

  assertNoBlockedReachableNodes(state);
  assertJsonSafe(state.context, "Workflow context must be JSON-safe.");
  return state.context;
};

const createExecutionState = (
  input: RunDurableGraphInput,
  startNode: WorkflowNode,
): GraphExecutionState => {
  const edgeIndexes = buildEdgeIndexes(input.graph.edges);
  const outgoingByNode = edgeIndexes.outgoingByNode;

  return {
    input,
    nodesById: new Map(input.graph.nodes.map((node) => [node.id, node])),
    incomingByNode: edgeIndexes.incomingByNode,
    outgoingByNode,
    reachableNodeIds: findReachableNodeIds(startNode.id, outgoingByNode),
    joinsByNode: new Map(input.graph.joins.map((join) => [join.nodeId, join])),
    context: {},
    completedNodes: new Set<string>(),
    passedEdges: new Set<string>(),
    failedEdges: new Set<string>(),
    queuedNodes: new Set<string>([startNode.id]),
    queue: [startNode.id],
    graphOrder: new Map(
      input.graph.nodes.map((node, index) => [node.id, index]),
    ),
    observedJournalBytes: 0,
    order: 0,
  };
};

const processReadyWave = async (
  step: RunDurableGraphStep,
  state: GraphExecutionState,
): Promise<ProcessNodeOutcome> => {
  const wave = dequeueReadyWave(state);
  if (wave.length === 0) {
    return { type: "continue" };
  }
  const outcomes = await Promise.allSettled(
    wave.map((node, index) =>
      runGraphNode(step, state, node, state.order + index),
    ),
  );
  for (const [index, node] of wave.entries()) {
    const outcome = outcomes[index];
    if (outcome?.status === "fulfilled")
      recordNodeResult(state, node, outcome.value);
  }
  const failedIndex = outcomes.findIndex(
    (outcome) => outcome.status === "rejected",
  );
  if (failedIndex >= 0)
    throw (outcomes[failedIndex] as PromiseRejectedResult).reason;
  for (const node of wave) enqueueActiveTargets(state, node);
  const outputIndex = wave.findIndex((node) => node.kind === "output");
  return outputIndex < 0
    ? { type: "continue" }
    : outputNodeResult(
        (outcomes[outputIndex] as PromiseFulfilledResult<unknown>).value,
      );
};

const dequeueReadyWave = (
  state: GraphExecutionState,
): readonly WorkflowNode[] => {
  const nodeIds = state.queue.splice(0);
  const nodes = nodeIds
    .flatMap((nodeId) => {
      state.queuedNodes.delete(nodeId);
      const node = state.nodesById.get(nodeId);
      return node && !state.completedNodes.has(nodeId) ? [node] : [];
    })
    .sort(
      (left, right) =>
        (state.graphOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (state.graphOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    );
  return nodes;
};

const runGraphNode = (
  step: RunDurableGraphStep,
  state: GraphExecutionState,
  node: WorkflowNode,
  order: number,
): Promise<unknown> =>
  runObservedWorkflowStage({
    step,
    ...observabilityArgs(state.input),
    nodeId: node.id,
    label: node.label,
    kind: node.kind,
    stageKey: node.id,
    attemptNumber: "unknown",
    order,
    run: () => executeAndValidateNode(step, state, node),
  });

const observabilityArgs = (
  input: RunDurableGraphInput,
): Partial<Parameters<typeof runObservedWorkflowStage>[0]> => {
  const refs = input.observability;
  return refs
    ? {
        refs,
        ...(refs.workflowRunId ? { workflowRunId: refs.workflowRunId } : {}),
        ...(refs.componentWorkflowId
          ? { componentWorkflowId: refs.componentWorkflowId }
          : {}),
      }
    : {};
};

const executeAndValidateNode = async (
  step: RunDurableGraphStep,
  state: GraphExecutionState,
  node: WorkflowNode,
): Promise<unknown> => {
  const result = await executeNode({
    step,
    input: state.input,
    node,
    context: state.context,
  });
  assertJsonSafe(result, `Workflow node ${node.id} returned non-JSON output.`);
  assertWorkflowPayloadBudget({
    surface: node.kind === "output" ? "workflow-return" : "step-result",
    phase:
      node.kind === "output"
        ? "pre-product-projection"
        : "pre-component-return",
    nodeId: node.id,
    value: result,
  });
  if (node.kind === "output") {
    assertJsonObject(result, "Workflow output must be a JSON object.");
  }
  return result;
};

const recordNodeResult = (
  state: GraphExecutionState,
  node: WorkflowNode,
  result: unknown,
): void => {
  state.order += 1;
  state.context[node.id] = result;
  state.observedJournalBytes = observeWorkflowPayload({
    nodeId: node.id,
    observedJournalBytes: state.observedJournalBytes,
    value: result,
  }).observedJournalBytes;
  state.completedNodes.add(node.id);
};

const outputNodeResult = (result: unknown): ProcessNodeOutcome => {
  assertJsonObject(result, "Workflow output must be a JSON object.");
  return { type: "output", value: result as Readonly<Record<string, unknown>> };
};

const enqueueActiveTargets = (
  state: GraphExecutionState,
  node: WorkflowNode,
): void => {
  for (const edge of state.outgoingByNode.get(node.id) ?? []) {
    const active = recordEdgeState(state, edge);
    enqueueTargetIfReady(state, edge, active);
  }
};

const recordEdgeState = (
  state: GraphExecutionState,
  edge: WorkflowNodeEdge,
): boolean => {
  const active = isEdgeActive({
    edge,
    input: state.input,
    context: state.context,
  });
  (active ? state.passedEdges : state.failedEdges).add(edge.id);
  return active;
};

const enqueueTargetIfReady = (
  state: GraphExecutionState,
  edge: WorkflowNodeEdge,
  active: boolean,
): void => {
  if (!active) {
    return;
  }
  const target = state.nodesById.get(edge.targetNodeId);
  if (target && shouldQueueTarget(state, target)) {
    state.queuedNodes.add(target.id);
    state.queue.push(target.id);
  }
};

const shouldQueueTarget = (
  state: GraphExecutionState,
  target: WorkflowNode,
): boolean =>
  !state.completedNodes.has(target.id) &&
  !state.queuedNodes.has(target.id) &&
  isNodeReady(target, state);

const assertNoBlockedReachableNodes = (state: GraphExecutionState): void => {
  const blockedReachableNodeIds = findBlockedReachableNodeIds({
    reachableNodeIds: state.reachableNodeIds,
    snapshot: state,
  });
  if (blockedReachableNodeIds.length === 0) {
    return;
  }
  throw makePublicError(
    "VALIDATION_FAILED",
    "Workflow graph traversal made no progress before completing reachable nodes.",
    { nodeIds: blockedReachableNodeIds.join(",") },
  );
};
