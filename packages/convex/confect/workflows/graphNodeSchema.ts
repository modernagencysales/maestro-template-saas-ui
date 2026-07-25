import * as S from "effect/Schema";
import {
  WORKFLOW_SEMANTICS,
  defineWorkflowSchemaFields,
  type WorkflowSemanticRuleId,
} from "@maestro-template/template-core/workflow-semantics";

import {
  WorkflowCapabilityReference,
  WorkflowEventReference,
  WorkflowReference,
  WorkflowStepName,
} from "./_kit/workflowReferences";

export const WorkflowNodeKind = S.Literal(
  "source",
  "capability",
  "agent",
  "delay",
  "approval",
  "output",
);

export type WorkflowNodeKind = S.Schema.Type<typeof WorkflowNodeKind>;

export const WorkflowRetrySchemaFields = defineWorkflowSchemaFields("retry", {
  maxAttempts: S.Number,
  backoffMs: S.Number,
});

export const WorkflowRetryConfig = S.Struct(WorkflowRetrySchemaFields);

export const WorkflowNodeSchemaFields = defineWorkflowSchemaFields("node", {
  id: S.String,
  kind: WorkflowNodeKind,
  label: S.String,
  capability: S.optional(S.String),
  agent: S.optional(S.String),
  delayMs: S.optional(S.Number),
  retry: WorkflowRetryConfig,
});

export const WorkflowNode = S.Struct(WorkflowNodeSchemaFields);

export type WorkflowNode = S.Schema.Type<typeof WorkflowNode>;

export const WorkflowRetryConfigV2 = S.Struct({
  maxAttempts: S.Number,
  initialBackoffMs: S.Number,
  base: S.Number,
});

export const WorkflowSchedule = S.Union(
  S.Struct({ kind: S.Literal("runAfter"), delayMs: S.Number }),
  S.Struct({ kind: S.Literal("runAt"), timestamp: S.Number }),
);

export const WorkflowPayloadPolicy = S.Struct({
  maxInputBytes: S.Number,
  maxResultBytes: S.Number,
  resultMode: S.Literal("inline", "artifact-reference"),
});

export const WorkflowTransactionLimits = S.Struct({
  bytesRead: S.optional(S.Number.pipe(S.int(), S.greaterThan(0))),
  bytesWritten: S.optional(S.Number.pipe(S.int(), S.greaterThan(0))),
  databaseQueries: S.optional(S.Number.pipe(S.int(), S.greaterThan(0))),
  documentsRead: S.optional(S.Number.pipe(S.int(), S.greaterThan(0))),
  documentsWritten: S.optional(S.Number.pipe(S.int(), S.greaterThan(0))),
  functionsScheduled: S.optional(S.Number.pipe(S.int(), S.greaterThan(0))),
  scheduledFunctionArgsBytes: S.optional(
    S.Number.pipe(S.int(), S.greaterThan(0)),
  ),
});

const WorkflowNodeV2BaseFields = {
  id: S.NonEmptyString,
  label: S.NonEmptyString,
  stepName: WorkflowStepName,
  payloadPolicy: WorkflowPayloadPolicy,
  semanticRuleIds: S.Array(
    S.Literal(
      ...(WORKFLOW_SEMANTICS.map(({ id }) => id) as [
        WorkflowSemanticRuleId,
        ...WorkflowSemanticRuleId[],
      ]),
    ),
  ),
} as const;

const WorkflowCapabilityV2BaseFields = {
  ...WorkflowNodeV2BaseFields,
  kind: S.Literal("capability"),
  capability: WorkflowCapabilityReference,
} as const;

export const WorkflowSourceNodeV2 = S.Struct({
  ...WorkflowNodeV2BaseFields,
  kind: S.Literal("source"),
});

export const WorkflowActionNodeV2 = S.Struct({
  ...WorkflowCapabilityV2BaseFields,
  functionKind: S.Literal("action"),
  retry: S.optional(WorkflowRetryConfigV2),
  schedule: S.optional(WorkflowSchedule),
});

const WorkflowIndependentTransaction = S.Struct({
  kind: S.Literal("independent"),
});

const WorkflowInlineTransaction = S.Struct({
  kind: S.Literal("inline"),
  posture: S.Literal("small-atomic"),
  limitsProfile: S.Literal("tiny", "small-atomic", "reviewed-explicit"),
  limits: WorkflowTransactionLimits,
});

const independentCapabilityNode = (functionKind: "query" | "mutation") =>
  S.Struct({
    ...WorkflowCapabilityV2BaseFields,
    functionKind: S.Literal(functionKind),
    transaction: WorkflowIndependentTransaction,
    schedule: S.optional(WorkflowSchedule),
  });

const inlineCapabilityNode = (functionKind: "query" | "mutation") =>
  S.Struct({
    ...WorkflowCapabilityV2BaseFields,
    functionKind: S.Literal(functionKind),
    transaction: WorkflowInlineTransaction,
  });

export const WorkflowQueryNodeV2 = S.Union(
  independentCapabilityNode("query"),
  inlineCapabilityNode("query"),
);

export const WorkflowMutationNodeV2 = S.Union(
  independentCapabilityNode("mutation"),
  inlineCapabilityNode("mutation"),
);

export const WorkflowAgentNodeV2 = S.Struct({
  ...WorkflowNodeV2BaseFields,
  kind: S.Literal("agent"),
  agent: WorkflowCapabilityReference,
  schedule: S.optional(WorkflowSchedule),
});

export const WorkflowDelayNodeV2 = S.Struct({
  ...WorkflowNodeV2BaseFields,
  kind: S.Literal("delay"),
  delayMs: S.Number,
});

export const WorkflowEventNodeV2 = S.Struct({
  ...WorkflowNodeV2BaseFields,
  kind: S.Literal("event"),
  eventDefinition: WorkflowEventReference,
  eventSchemaName: S.NonEmptyString,
  eventInstanceKey: S.NonEmptyString,
});

export const WorkflowSubworkflowNodeV2 = S.Struct({
  ...WorkflowNodeV2BaseFields,
  kind: S.Literal("subworkflow"),
  workflow: WorkflowReference,
  childVersion: S.Number,
});

export const WorkflowOutputNodeV2 = S.Struct({
  ...WorkflowNodeV2BaseFields,
  kind: S.Literal("output"),
});

export const WorkflowNodeV2 = S.Union(
  WorkflowSourceNodeV2,
  WorkflowActionNodeV2,
  WorkflowQueryNodeV2,
  WorkflowMutationNodeV2,
  WorkflowAgentNodeV2,
  WorkflowDelayNodeV2,
  WorkflowEventNodeV2,
  WorkflowSubworkflowNodeV2,
  WorkflowOutputNodeV2,
);

export type WorkflowNodeV2 = S.Schema.Type<typeof WorkflowNodeV2>;
