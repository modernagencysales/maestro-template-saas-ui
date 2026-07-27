import type { WorkflowEdge, WorkflowJoin, WorkflowNode } from "../graph";

export type EdgeIndexes = {
  readonly incomingByNode: ReadonlyMap<string, readonly WorkflowEdge[]>;
  readonly outgoingByNode: ReadonlyMap<string, readonly WorkflowEdge[]>;
};

export type TraversalSnapshot = {
  readonly incomingByNode: ReadonlyMap<string, readonly WorkflowEdge[]>;
  readonly joinsByNode: ReadonlyMap<string, WorkflowJoin>;
  readonly completedNodes: ReadonlySet<string>;
  readonly passedEdges: ReadonlySet<string>;
  readonly failedEdges: ReadonlySet<string>;
};

type ReadyWaveNode = { readonly id: string };

export const findReadyWave = <Node extends ReadyWaveNode>(
  nodes: readonly Node[],
  snapshot: TraversalSnapshot,
): readonly Node[] => {
  const declaredOrder = new Map(
    nodes.map((node, index) => [node.id, index] as const),
  );
  return nodes
    .filter(
      (node) =>
        !snapshot.completedNodes.has(node.id) && isNodeReady(node, snapshot),
    )
    .sort(
      (left, right) =>
        (declaredOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (declaredOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    );
};

type SkippedNodeResolver = {
  readonly isNodeSkipped: (nodeId: string) => boolean;
};

type SkippedNodeContext = {
  readonly snapshot: TraversalSnapshot;
  readonly skippedNodeResults: Map<string, boolean>;
  readonly visitingNodeIds: Set<string>;
  readonly isNodeSkipped: (nodeId: string) => boolean;
};

export const buildEdgeIndexes = (
  edges: readonly WorkflowEdge[],
): EdgeIndexes => ({
  incomingByNode: groupEdges(edges, "targetNodeId"),
  outgoingByNode: groupEdges(edges, "sourceNodeId"),
});

export const isNodeReady = (
  node: Pick<WorkflowNode, "id">,
  snapshot: TraversalSnapshot,
): boolean => {
  const incoming = snapshot.incomingByNode.get(node.id) ?? [];
  const join = snapshot.joinsByNode.get(node.id);
  const skippedNodes = createSkippedNodeResolver(snapshot);

  return join
    ? isJoinReady(join, incoming, snapshot.passedEdges)
    : isSimpleNodeReady(incoming, snapshot, skippedNodes);
};

export const findBlockedReachableNodeIds = ({
  reachableNodeIds,
  snapshot,
}: {
  readonly reachableNodeIds: ReadonlySet<string>;
  readonly snapshot: TraversalSnapshot;
}): readonly string[] => {
  const skippedNodes = createSkippedNodeResolver(snapshot);

  return [...reachableNodeIds].filter(
    (nodeId) =>
      !snapshot.completedNodes.has(nodeId) &&
      !skippedNodes.isNodeSkipped(nodeId),
  );
};

export const findReachableNodeIds = (
  startNodeId: string,
  outgoingByNode: ReadonlyMap<string, readonly WorkflowEdge[]>,
): ReadonlySet<string> => {
  const reachable = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (shouldSkipReachableNode(nodeId, reachable)) {
      continue;
    }
    reachable.add(nodeId);
    queue.push(...nextUnvisitedTargets(nodeId, outgoingByNode, reachable));
  }

  return reachable;
};

const isJoinReady = (
  join: WorkflowJoin,
  incoming: readonly WorkflowEdge[],
  passedEdges: ReadonlySet<string>,
): boolean =>
  join.strategy === "all-successful"
    ? join.sourceNodeIds.every((sourceNodeId) =>
        sourceHasPassedEdge(sourceNodeId, incoming, passedEdges),
      )
    : join.sourceNodeIds.some((sourceNodeId) =>
        sourceHasPassedEdge(sourceNodeId, incoming, passedEdges),
      );

const isSimpleNodeReady = (
  incoming: readonly WorkflowEdge[],
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean =>
  incoming.length === 0 ||
  (incoming.some((edge) => snapshot.passedEdges.has(edge.id)) &&
    incoming.every((edge) => isEdgeResolved(edge, snapshot, skippedNodes)));

const isEdgeResolved = (
  edge: WorkflowEdge,
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean =>
  snapshot.passedEdges.has(edge.id) ||
  snapshot.failedEdges.has(edge.id) ||
  skippedNodes.isNodeSkipped(edge.sourceNodeId);

const createSkippedNodeResolver = (
  snapshot: TraversalSnapshot,
): SkippedNodeResolver => {
  const skippedNodeResults = new Map<string, boolean>();
  const visitingNodeIds = new Set<string>();

  const isNodeSkipped = (nodeId: string): boolean =>
    snapshot.completedNodes.has(nodeId)
      ? false
      : readSkippedNodeResult(nodeId, {
          snapshot,
          skippedNodeResults,
          visitingNodeIds,
          isNodeSkipped,
        });

  return { isNodeSkipped };
};

const readSkippedNodeResult = (
  nodeId: string,
  context: SkippedNodeContext,
): boolean => {
  const memoized = context.skippedNodeResults.get(nodeId);
  if (memoized !== undefined) {
    return memoized;
  }
  if (context.visitingNodeIds.has(nodeId)) {
    return false;
  }
  return resolveSkippedNode(nodeId, context);
};

const resolveSkippedNode = (
  nodeId: string,
  context: SkippedNodeContext,
): boolean => {
  context.visitingNodeIds.add(nodeId);
  const skipped = computeSkippedNode(nodeId, context.snapshot, {
    isNodeSkipped: context.isNodeSkipped,
  });
  context.visitingNodeIds.delete(nodeId);
  context.skippedNodeResults.set(nodeId, skipped);
  return skipped;
};

const computeSkippedNode = (
  nodeId: string,
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean => {
  const incoming = snapshot.incomingByNode.get(nodeId) ?? [];
  const join = snapshot.joinsByNode.get(nodeId);

  if (incoming.length === 0) {
    return false;
  }
  return join
    ? isSkippedJoin(join, incoming, snapshot, skippedNodes)
    : isSkippedSimpleNode(incoming, snapshot, skippedNodes);
};

const isSkippedJoin = (
  join: WorkflowJoin,
  incoming: readonly WorkflowEdge[],
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean =>
  join.strategy === "all-successful"
    ? isSkippedAllSuccessfulJoin(join, incoming, snapshot, skippedNodes)
    : isSkippedAnySuccessfulJoin(join, incoming, snapshot, skippedNodes);

const isSkippedAllSuccessfulJoin = (
  join: WorkflowJoin,
  incoming: readonly WorkflowEdge[],
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean => {
  const everySourceResolved = join.sourceNodeIds.every((sourceNodeId) =>
    sourceIsResolved(sourceNodeId, incoming, snapshot, skippedNodes),
  );
  const everySourcePassed = join.sourceNodeIds.every((sourceNodeId) =>
    sourceHasPassedEdge(sourceNodeId, incoming, snapshot.passedEdges),
  );

  return everySourceResolved && !everySourcePassed;
};

const isSkippedAnySuccessfulJoin = (
  join: WorkflowJoin,
  incoming: readonly WorkflowEdge[],
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean => {
  const anySourcePassed = join.sourceNodeIds.some((sourceNodeId) =>
    sourceHasPassedEdge(sourceNodeId, incoming, snapshot.passedEdges),
  );
  return (
    !anySourcePassed &&
    join.sourceNodeIds.every((sourceNodeId) =>
      sourceEdgesAreUnavailable(sourceNodeId, incoming, snapshot, skippedNodes),
    )
  );
};

const isSkippedSimpleNode = (
  incoming: readonly WorkflowEdge[],
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean =>
  !incoming.some((edge) => snapshot.passedEdges.has(edge.id)) &&
  incoming.every((edge) => isEdgeUnavailable(edge, snapshot, skippedNodes));

const sourceIsResolved = (
  sourceNodeId: string,
  incoming: readonly WorkflowEdge[],
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean =>
  sourceHasPassedEdge(sourceNodeId, incoming, snapshot.passedEdges) ||
  sourceEdgesAreUnavailable(sourceNodeId, incoming, snapshot, skippedNodes);

const sourceHasPassedEdge = (
  sourceNodeId: string,
  edges: readonly WorkflowEdge[],
  passedEdges: ReadonlySet<string>,
): boolean =>
  edges.some(
    (edge) => edge.sourceNodeId === sourceNodeId && passedEdges.has(edge.id),
  );

const sourceEdgesAreUnavailable = (
  sourceNodeId: string,
  edges: readonly WorkflowEdge[],
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean => {
  const sourceEdges = edges.filter(
    (edge) => edge.sourceNodeId === sourceNodeId,
  );
  return (
    sourceEdges.length > 0 &&
    sourceEdges.every((edge) => isEdgeUnavailable(edge, snapshot, skippedNodes))
  );
};

const isEdgeUnavailable = (
  edge: WorkflowEdge,
  snapshot: TraversalSnapshot,
  skippedNodes: SkippedNodeResolver,
): boolean =>
  snapshot.failedEdges.has(edge.id) ||
  skippedNodes.isNodeSkipped(edge.sourceNodeId);

const groupEdges = (
  edges: readonly WorkflowEdge[],
  key: "sourceNodeId" | "targetNodeId",
): ReadonlyMap<string, readonly WorkflowEdge[]> => {
  const grouped = new Map<string, WorkflowEdge[]>();
  for (const edge of edges) {
    grouped.set(edge[key], [...(grouped.get(edge[key]) ?? []), edge]);
  }
  return grouped;
};

const shouldSkipReachableNode = (
  nodeId: string | undefined,
  reachable: ReadonlySet<string>,
): nodeId is undefined => !nodeId || reachable.has(nodeId);

const nextUnvisitedTargets = (
  nodeId: string,
  outgoingByNode: ReadonlyMap<string, readonly WorkflowEdge[]>,
  reachable: ReadonlySet<string>,
): readonly string[] =>
  (outgoingByNode.get(nodeId) ?? [])
    .map((edge) => edge.targetNodeId)
    .filter((targetNodeId) => !reachable.has(targetNodeId));
