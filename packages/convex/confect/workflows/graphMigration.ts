import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import {
  DurableWorkflowGraph,
  type DurableWorkflowGraph as LegacyWorkflowGraph,
  type WorkflowNode,
} from "./graph";

export const LegacyDurableWorkflowGraph = DurableWorkflowGraph;

export type LegacyDurableWorkflowGraph = LegacyWorkflowGraph;

export class WorkflowGraphMigrationError extends Schema.TaggedError<WorkflowGraphMigrationError>()(
  "WorkflowGraphMigrationError",
  {
    sourceVersion: Schema.Literal(1),
    issue: Schema.String,
  },
) {}

export type MigratedLegacyWorkflowNode = Omit<WorkflowNode, "retry"> & {
  readonly stepName: string;
};

export type MigratedLegacyWorkflowGraph = Omit<LegacyWorkflowGraph, "nodes"> & {
  readonly schemaVersion: 2;
  readonly nodes: readonly MigratedLegacyWorkflowNode[];
};

export const decodeLegacyWorkflowGraph = (
  input: unknown,
): Either.Either<LegacyDurableWorkflowGraph, WorkflowGraphMigrationError> => {
  if (hasSchemaVersion(input)) {
    return Either.left(
      new WorkflowGraphMigrationError({
        sourceVersion: 1,
        issue: "Versioned graph input cannot be decoded as legacy V1.",
      }),
    );
  }

  try {
    return Either.right(
      Schema.decodeUnknownSync(LegacyDurableWorkflowGraph)(input),
    );
  } catch {
    return Either.left(
      new WorkflowGraphMigrationError({
        sourceVersion: 1,
        issue: "Input does not match the durable workflow graph V1 schema.",
      }),
    );
  }
};

export const migrateLegacyWorkflowGraph = (
  input: unknown,
): Either.Either<MigratedLegacyWorkflowGraph, WorkflowGraphMigrationError> =>
  Either.map(decodeLegacyWorkflowGraph(input), (graph) => ({
    schemaVersion: 2,
    id: graph.id,
    version: graph.version,
    startNodeId: graph.startNodeId,
    nodes: graph.nodes.map((node) => migrateLegacyNode(node, graph.version)),
    edges: graph.edges,
    joins: graph.joins,
  }));

const migrateLegacyNode = (
  node: WorkflowNode,
  workflowVersion: number,
): MigratedLegacyWorkflowNode => {
  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    ...(node.capability === undefined ? {} : { capability: node.capability }),
    ...(node.agent === undefined ? {} : { agent: node.agent }),
    ...(node.delayMs === undefined ? {} : { delayMs: node.delayMs }),
    stepName: `${node.id}.v${workflowVersion}`,
  };
};

const hasSchemaVersion = (
  input: unknown,
): input is Readonly<Record<string, unknown>> =>
  typeof input === "object" &&
  input !== null &&
  Object.hasOwn(input, "schemaVersion");
