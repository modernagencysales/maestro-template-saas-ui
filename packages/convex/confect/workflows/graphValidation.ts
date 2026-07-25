import {
  WorkflowGraphValidationError,
  type DurableWorkflowGraph,
  type WorkflowEdge,
  type WorkflowNode,
} from "./graph";
import { isSafeConditionExpression } from "./conditionExpression";
import type { DurableWorkflowGraphV2 } from "./graphSchema";

type ValidationState = {
  readonly errors: WorkflowGraphValidationError[];
  readonly nodeIds: ReadonlySet<string>;
  readonly edgeKeys: ReadonlySet<string>;
};

export const validateWorkflowGraph = (
  graph: DurableWorkflowGraph,
): readonly WorkflowGraphValidationError[] => {
  const nodeState = validateNodes(graph);
  const edgeState = validateEdges(graph, nodeState.nodeIds);
  const state = {
    errors: [...nodeState.errors, ...edgeState.errors],
    nodeIds: nodeState.nodeIds,
    edgeKeys: edgeState.edgeKeys,
  };

  validateStartNode(graph, state);
  validateJoins(graph, state);
  return state.errors;
};

const validateNodes = (
  graph: DurableWorkflowGraph,
): {
  readonly errors: WorkflowGraphValidationError[];
  readonly nodeIds: ReadonlySet<string>;
} => {
  const errors: WorkflowGraphValidationError[] = [];
  const nodeIds = new Set<string>();
  const duplicateNodeIds = new Set<string>();

  for (const node of graph.nodes) {
    trackDuplicate(node.id, nodeIds, duplicateNodeIds);
    errors.push(...validateNode(node));
  }

  for (const nodeId of duplicateNodeIds) {
    errors.push(new WorkflowGraphValidationError.DuplicateNodeId({ nodeId }));
  }

  return { errors, nodeIds };
};

const validateNode = (
  node: WorkflowNode,
): readonly WorkflowGraphValidationError[] => [
  ...validateRetryConfig(node),
  ...validateDelayConfig(node),
];

const validateRetryConfig = (
  node: WorkflowNode,
): readonly WorkflowGraphValidationError[] => [
  ...(node.retry.maxAttempts < 1
    ? [
        new WorkflowGraphValidationError.InvalidRetryConfig({
          nodeId: node.id,
          field: "maxAttempts",
        }),
      ]
    : []),
  ...(node.retry.backoffMs < 0
    ? [
        new WorkflowGraphValidationError.InvalidRetryConfig({
          nodeId: node.id,
          field: "backoffMs",
        }),
      ]
    : []),
];

const validateDelayConfig = (
  node: WorkflowNode,
): readonly WorkflowGraphValidationError[] =>
  node.kind === "delay" && isInvalidDelayMs(node.delayMs)
    ? [
        new WorkflowGraphValidationError.InvalidDelayConfig({
          nodeId: node.id,
          field: "delayMs",
        }),
      ]
    : [];

const isInvalidDelayMs = (delayMs: number | undefined): boolean =>
  !Number.isInteger(delayMs) || (delayMs ?? 0) <= 0;

const validateEdges = (
  graph: DurableWorkflowGraph,
  nodeIds: ReadonlySet<string>,
): {
  readonly errors: WorkflowGraphValidationError[];
  readonly edgeKeys: ReadonlySet<string>;
} => {
  const errors: WorkflowGraphValidationError[] = [];
  const edgeIds = new Set<string>();
  const duplicateEdgeIds = new Set<string>();
  const edgeKeys = new Set<string>();

  for (const edge of graph.edges) {
    trackDuplicate(edge.id, edgeIds, duplicateEdgeIds);
    edgeKeys.add(edgeKey(edge.sourceNodeId, edge.targetNodeId));
    errors.push(...validateEdge(edge, nodeIds));
  }

  for (const edgeId of duplicateEdgeIds) {
    errors.push(new WorkflowGraphValidationError.DuplicateEdgeId({ edgeId }));
  }

  return { errors, edgeKeys };
};

const validateEdge = (
  edge: WorkflowEdge,
  nodeIds: ReadonlySet<string>,
): readonly WorkflowGraphValidationError[] => [
  ...validateEdgeEndpoint(edge, edge.sourceNodeId, nodeIds),
  ...validateEdgeEndpoint(edge, edge.targetNodeId, nodeIds),
  ...validateEdgeCondition(edge),
];

const validateEdgeEndpoint = (
  edge: WorkflowEdge,
  nodeId: string,
  nodeIds: ReadonlySet<string>,
): readonly WorkflowGraphValidationError[] =>
  nodeIds.has(nodeId)
    ? []
    : [
        new WorkflowGraphValidationError.DanglingEdge({
          edgeId: edge.id,
          nodeId,
        }),
      ];

const validateEdgeCondition = (
  edge: WorkflowEdge,
): readonly WorkflowGraphValidationError[] =>
  edge.condition && !isSafeConditionExpression(edge.condition.expression)
    ? [
        new WorkflowGraphValidationError.InvalidConditionExpression({
          edgeId: edge.id,
        }),
      ]
    : [];

const validateStartNode = (
  graph: DurableWorkflowGraph,
  state: ValidationState,
): void => {
  if (state.nodeIds.has(graph.startNodeId)) {
    return;
  }
  state.errors.push(
    new WorkflowGraphValidationError.MissingStartNode({
      startNodeId: graph.startNodeId,
    }),
  );
};

const validateJoins = (
  graph: DurableWorkflowGraph,
  state: ValidationState,
): void => {
  for (const join of graph.joins) {
    if (!state.nodeIds.has(join.nodeId)) {
      state.errors.push(invalidJoin(join.nodeId, "join node is not in graph"));
    }
    for (const sourceNodeId of join.sourceNodeIds) {
      state.errors.push(
        ...validateJoinSource(join.nodeId, sourceNodeId, state),
      );
    }
  }
};

const validateJoinSource = (
  joinNodeId: string,
  sourceNodeId: string,
  state: ValidationState,
): readonly WorkflowGraphValidationError[] => {
  if (!state.nodeIds.has(sourceNodeId)) {
    return [invalidJoin(sourceNodeId, "join source node is not in graph")];
  }
  if (isConnectedJoinSource(joinNodeId, sourceNodeId, state)) {
    return [];
  }
  return [
    invalidJoin(
      joinNodeId,
      `join source node ${sourceNodeId} has no edge to join node`,
    ),
  ];
};

const isConnectedJoinSource = (
  joinNodeId: string,
  sourceNodeId: string,
  state: ValidationState,
): boolean =>
  !state.nodeIds.has(joinNodeId) ||
  state.edgeKeys.has(edgeKey(sourceNodeId, joinNodeId));

const invalidJoin = (
  nodeId: string,
  reason: string,
): WorkflowGraphValidationError =>
  new WorkflowGraphValidationError.InvalidJoin({ nodeId, reason });

const trackDuplicate = (
  id: string,
  ids: Set<string>,
  duplicateIds: Set<string>,
): void => {
  if (ids.has(id)) {
    duplicateIds.add(id);
  }
  ids.add(id);
};

export const validateWorkflowGraphV2 = (
  graph: DurableWorkflowGraphV2,
): readonly string[] => {
  const sources = graph.nodes.filter((node) => node.kind === "source");
  const outputs = graph.nodes.filter((node) => node.kind === "output");
  const outgoing = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  for (const edge of graph.edges) {
    append(outgoing, edge.sourceNodeId, edge.targetNodeId);
    append(reverse, edge.targetNodeId, edge.sourceNodeId);
  }
  const reachable = walk(graph.startNodeId, outgoing);
  const reachesOutput = new Set(
    outputs.flatMap((node) => [...walk(node.id, reverse)]),
  );
  const duplicateStepNames = duplicates(
    graph.nodes.map((node) => node.stepName),
  );

  return [
    ...(sources.length === 1 ? [] : ["exactly one source node is required"]),
    ...(outputs.length === 1 ? [] : ["exactly one output node is required"]),
    ...(sources[0]?.id === graph.startNodeId
      ? []
      : ["startNodeId must identify the source node"]),
    ...outputs.flatMap((node) =>
      (outgoing.get(node.id)?.length ?? 0) === 0
        ? []
        : [`output node ${node.id} cannot have outgoing edges`],
    ),
    ...graph.nodes.flatMap((node) =>
      reachable.has(node.id)
        ? []
        : [`node ${node.id} is unreachable from source`],
    ),
    ...graph.nodes.flatMap((node) =>
      reachesOutput.has(node.id)
        ? []
        : [`node ${node.id} does not converge on the output`],
    ),
    ...(hasCycle(
      graph.nodes.map((node) => node.id),
      outgoing,
    )
      ? ["workflow graph must be acyclic"]
      : []),
    ...graph.joins.flatMap((join) =>
      join.strategy === "any-successful"
        ? [
            "any-successful joins require a typed mutually-exclusive branch or reviewed loser policy",
          ]
        : [],
    ),
    ...duplicateStepNames.map((name) => `duplicate stepName: ${name}`),
  ];
};

const append = (
  index: Map<string, string[]>,
  key: string,
  value: string,
): void => {
  const values = index.get(key) ?? [];
  values.push(value);
  index.set(key, values);
};

const walk = (
  start: string,
  index: ReadonlyMap<string, readonly string[]>,
): ReadonlySet<string> => {
  const visited = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.shift();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    pending.push(...(index.get(current) ?? []));
  }
  return visited;
};

const hasCycle = (
  nodeIds: readonly string[],
  outgoing: ReadonlyMap<string, readonly string[]>,
): boolean => {
  const indegree = new Map(nodeIds.map((id) => [id, 0]));
  for (const targets of outgoing.values()) {
    for (const target of targets) {
      if (indegree.has(target))
        indegree.set(target, (indegree.get(target) ?? 0) + 1);
    }
  }
  const pending = nodeIds.filter((id) => indegree.get(id) === 0);
  let visited = 0;
  while (pending.length > 0) {
    const current = pending.shift();
    if (current === undefined) continue;
    visited += 1;
    for (const target of outgoing.get(current) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) pending.push(target);
    }
  }
  return visited !== nodeIds.length;
};

const duplicates = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
};

const edgeKey = (sourceNodeId: string, targetNodeId: string): string =>
  `${sourceNodeId}\0${targetNodeId}`;
