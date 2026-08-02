import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import {
  DurableWorkflowGraph,
  type DurableWorkflowGraphV2,
  type DurableWorkflowGraph as LegacyWorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeV2,
} from "./graph";
import { defineWorkflowGraphV2 } from "./_kit/workflowBuilder";
import { stableWorkflowStepName } from "./_kit/workflowBuilder";
import type {
  WorkflowCapabilityReference,
  WorkflowEventReference,
} from "./_kit/workflowReferences";

export const LegacyDurableWorkflowGraph = DurableWorkflowGraph;

export type LegacyDurableWorkflowGraph = LegacyWorkflowGraph;

export class WorkflowGraphMigrationError extends Schema.TaggedErrorClass<WorkflowGraphMigrationError>()(
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
  readonly capabilityBindings?: Readonly<
    Record<
      string,
      {
        readonly kind: "query" | "mutation" | "action";
        readonly reference: WorkflowCapabilityReference;
      }
    >
  >;
  readonly agentBindings?: Readonly<
    Record<string, WorkflowCapabilityReference>
  >;
  readonly eventContracts?: Readonly<
    Record<
      string,
      {
        readonly eventDefinition: WorkflowEventReference;
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
): Result.Result<LegacyDurableWorkflowGraph, WorkflowGraphMigrationError> => {
  if (hasSchemaVersion(input)) {
    return Result.fail(
      new WorkflowGraphMigrationError({
        sourceVersion: 1,
        issue: "Versioned graph input cannot be decoded as legacy V1.",
      }),
    );
  }

  const decoded = Schema.decodeUnknownExit(LegacyDurableWorkflowGraph)(input);
  if (Exit.isFailure(decoded)) {
    return Result.fail(
      new WorkflowGraphMigrationError({
        sourceVersion: 1,
        issue: "Input does not match the durable workflow graph V1 schema.",
      }),
    );
  }
  return Result.succeed(decoded.value);
};

export const migrateLegacyWorkflowGraph = (
  input: unknown,
  options: LegacyWorkflowMigrationOptions,
): Result.Result<MigratedLegacyWorkflowGraph, WorkflowGraphMigrationError> => {
  const decoded = decodeLegacyWorkflowGraph(input);
  return Result.isFailure(decoded)
    ? Result.fail(decoded.failure)
    : migrateDecodedGraph(decoded.success, options);
};

const migrateDecodedGraph = (
  graph: LegacyWorkflowGraph,
  options: LegacyWorkflowMigrationOptions,
): Result.Result<MigratedLegacyWorkflowGraph, WorkflowGraphMigrationError> => {
  const nodes: WorkflowNodeV2[] = [];
  for (const node of graph.nodes) {
    const migrated = migrateLegacyNode(node, graph.version, options);
    if (Result.isFailure(migrated)) return Result.fail(migrated.failure);
    nodes.push(migrated.success);
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
  return Result.mapError(
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
): Result.Result<WorkflowNodeV2, WorkflowGraphMigrationError> => {
  const common = {
    id: node.id,
    label: node.label,
    stepName: stableWorkflowStepName({
      name: node.id,
      version: workflowVersion,
    }),
    payloadPolicy: options.payloadPolicy,
  } as const;
  if (node.kind === "source" || node.kind === "output") {
    return Result.succeed({
      ...common,
      kind: node.kind,
      semanticRuleIds: ["WF-NODE-KIND"],
    });
  }
  if (node.kind === "delay") {
    return Result.succeed({
      ...common,
      kind: "delay",
      delayMs: node.delayMs ?? 0,
      failurePolicy: { kind: "fail" },
      semanticRuleIds: ["WF-STEP-SLEEP"],
    });
  }
  if (node.kind === "approval") {
    const event = options.eventContracts?.[node.id];
    return event === undefined
      ? migrationFailure(`missing event contract for ${node.id}`)
      : Result.succeed({
          ...common,
          kind: "event",
          ...event,
          failurePolicy: { kind: "fail" },
          semanticRuleIds: ["WF-STEP-EVENT"],
        });
  }
  if (node.kind === "agent") {
    const legacyAgent = node.agent ?? node.capability;
    const agent =
      legacyAgent === undefined
        ? undefined
        : options.agentBindings?.[legacyAgent];
    return agent === undefined
      ? migrationFailure(`missing generated agent binding for ${node.id}`)
      : Result.succeed({
          ...common,
          kind: "agent",
          agent,
          failurePolicy: { kind: "fail" },
          semanticRuleIds: ["WF-NODE-AGENT"],
        });
  }
  const capability = node.capability;
  if (capability === undefined) {
    return migrationFailure(`missing capability ref for ${node.id}`);
  }
  const binding = options.capabilityBindings?.[capability];
  if (binding === undefined) {
    return migrationFailure(`missing capability binding for ${capability}`);
  }
  const { kind: functionKind, reference } = binding;
  if (functionKind === "action") {
    return Result.succeed({
      ...common,
      kind: "capability",
      functionKind,
      capability: reference,
      failurePolicy: { kind: "fail" },
      semanticRuleIds: ["WF-STEP-ACTION"],
    });
  }
  return Result.succeed({
    ...common,
    kind: "capability",
    functionKind,
    capability: reference,
    transaction: { kind: "independent" },
    failurePolicy: { kind: "fail" },
    semanticRuleIds: [
      functionKind === "query" ? "WF-STEP-QUERY" : "WF-STEP-MUTATION",
    ],
  });
};

const migrationFailure = (
  issue: string,
): Result.Result<never, WorkflowGraphMigrationError> =>
  Result.fail(new WorkflowGraphMigrationError({ sourceVersion: 1, issue }));

const hasSchemaVersion = (
  input: unknown,
): input is Readonly<Record<string, unknown>> =>
  typeof input === "object" &&
  input !== null &&
  Object.hasOwn(input, "schemaVersion");
