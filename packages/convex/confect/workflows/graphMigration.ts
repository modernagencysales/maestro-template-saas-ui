import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import {
  DurableWorkflowGraph,
  type DurableWorkflowGraphV2,
  type DurableWorkflowGraph as LegacyWorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeV2,
} from "./graph";
import { defineWorkflowGraphV2 } from "./_kit/workflowBuilder";

export const LegacyDurableWorkflowGraph = DurableWorkflowGraph;

export type LegacyDurableWorkflowGraph = LegacyWorkflowGraph;

export class WorkflowGraphMigrationError extends Schema.TaggedError<WorkflowGraphMigrationError>()(
  "WorkflowGraphMigrationError",
  {
    sourceVersion: Schema.Literal(1),
    issue: Schema.String,
  },
) {}

export type LegacyWorkflowMigrationOptions = Pick<
  DurableWorkflowGraphV2,
  | "argsSchemaName"
  | "returnSchemaName"
  | "principalSchemaName"
  | "policyPosture"
> & {
  readonly payloadPolicy: WorkflowNodeV2["payloadPolicy"];
  readonly capabilityKinds?: Readonly<
    Record<string, "query" | "mutation" | "action">
  >;
  readonly eventContracts?: Readonly<
    Record<
      string,
      {
        readonly eventDefinition: string;
        readonly eventSchemaName: string;
        readonly eventInstanceKey: string;
      }
    >
  >;
  readonly kickoffProfiles?: DurableWorkflowGraphV2["kickoffProfiles"];
  readonly unstableArgs?: DurableWorkflowGraphV2["unstableArgs"];
};

export type MigratedLegacyWorkflowGraph = DurableWorkflowGraphV2;

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
  options: LegacyWorkflowMigrationOptions,
): Either.Either<MigratedLegacyWorkflowGraph, WorkflowGraphMigrationError> => {
  const decoded = decodeLegacyWorkflowGraph(input);
  return Either.isLeft(decoded)
    ? Either.left(decoded.left)
    : migrateDecodedGraph(decoded.right, options);
};

const migrateDecodedGraph = (
  graph: LegacyWorkflowGraph,
  options: LegacyWorkflowMigrationOptions,
): Either.Either<MigratedLegacyWorkflowGraph, WorkflowGraphMigrationError> => {
  const nodes: WorkflowNodeV2[] = [];
  for (const node of graph.nodes) {
    const migrated = migrateLegacyNode(node, graph.version, options);
    if (Either.isLeft(migrated)) return Either.left(migrated.left);
    nodes.push(migrated.right);
  }
  const built = defineWorkflowGraphV2({
    id: graph.id,
    version: graph.version,
    startNodeId: graph.startNodeId,
    argsSchemaName: options.argsSchemaName,
    returnSchemaName: options.returnSchemaName,
    principalSchemaName: options.principalSchemaName,
    policyPosture: options.policyPosture,
    ...(options.kickoffProfiles === undefined
      ? {}
      : { kickoffProfiles: options.kickoffProfiles }),
    ...(options.unstableArgs === undefined
      ? {}
      : { unstableArgs: options.unstableArgs }),
    nodes,
    edges: graph.edges,
    joins: graph.joins,
  });
  return Either.mapLeft(
    built,
    (error) =>
      new WorkflowGraphMigrationError({
        sourceVersion: 1,
        issue: error.findings.join("; "),
      }),
  );
};

const migrateLegacyNode = (
  node: WorkflowNode,
  workflowVersion: number,
  options: LegacyWorkflowMigrationOptions,
): Either.Either<WorkflowNodeV2, WorkflowGraphMigrationError> => {
  const common = {
    id: node.id,
    label: node.label,
    stepName: `${node.id}.v${workflowVersion}`,
    payloadPolicy: options.payloadPolicy,
  } as const;
  if (node.kind === "source" || node.kind === "output") {
    return Either.right({
      ...common,
      kind: node.kind,
      semanticRuleIds: ["WF-NODE-KIND"],
    });
  }
  if (node.kind === "delay") {
    return Either.right({
      ...common,
      kind: "delay",
      delayMs: node.delayMs ?? 0,
      semanticRuleIds: ["WF-STEP-SLEEP"],
    });
  }
  if (node.kind === "approval") {
    const event = options.eventContracts?.[node.id];
    return event === undefined
      ? migrationFailure(`missing event contract for ${node.id}`)
      : Either.right({
          ...common,
          kind: "event",
          ...event,
          semanticRuleIds: ["WF-STEP-EVENT"],
        });
  }
  if (node.kind === "agent") {
    const agent = node.agent ?? node.capability;
    return agent === undefined
      ? migrationFailure(`missing agent ref for ${node.id}`)
      : Either.right({
          ...common,
          kind: "agent",
          agent,
          semanticRuleIds: ["WF-NODE-AGENT"],
        });
  }
  const capability = node.capability;
  if (capability === undefined) {
    return migrationFailure(`missing capability ref for ${node.id}`);
  }
  const functionKind = options.capabilityKinds?.[capability];
  if (functionKind === undefined) {
    return migrationFailure(`missing capability kind for ${capability}`);
  }
  if (functionKind === "action") {
    return Either.right({
      ...common,
      kind: "capability",
      functionKind,
      capability,
      semanticRuleIds: ["WF-STEP-ACTION"],
    });
  }
  return Either.right({
    ...common,
    kind: "capability",
    functionKind,
    capability,
    transaction: { kind: "independent" },
    semanticRuleIds: [
      functionKind === "query" ? "WF-STEP-QUERY" : "WF-STEP-MUTATION",
    ],
  });
};

const migrationFailure = (
  issue: string,
): Either.Either<never, WorkflowGraphMigrationError> =>
  Either.left(new WorkflowGraphMigrationError({ sourceVersion: 1, issue }));

const hasSchemaVersion = (
  input: unknown,
): input is Readonly<Record<string, unknown>> =>
  typeof input === "object" &&
  input !== null &&
  Object.hasOwn(input, "schemaVersion");
