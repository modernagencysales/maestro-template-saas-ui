import * as Data from "effect/Data";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import {
  decodeDurableWorkflowGraphV2,
  type DurableWorkflowGraphV2,
} from "../graphSchema";
import {
  WorkflowActionNodeV2,
  WorkflowAgentNodeV2,
  WorkflowDelayNodeV2,
  WorkflowEventNodeV2,
  WorkflowMutationNodeV2,
  WorkflowOutputNodeV2,
  WorkflowQueryNodeV2,
  WorkflowSourceNodeV2,
  WorkflowSubworkflowNodeV2,
} from "../graphNodeSchema";
import { validateWorkflowGraphV2 } from "../graphValidation";
import type { WorkflowGraphV2Finding } from "../graphValidation";
import {
  WorkflowStepName,
  type WorkflowStepName as WorkflowStepNameType,
} from "./workflowReferences";
import {
  inlineTransactionPreset,
  type InlineTransactionPresetName,
  type ReviewedInlineTransaction,
} from "./inlineTransactions";
import { unsupportedWorkflowFailurePolicyFinding } from "./failurePolicy";

type SourceNode = Schema.Schema.Type<typeof WorkflowSourceNodeV2>;
type ActionNode = Schema.Schema.Type<typeof WorkflowActionNodeV2>;
type QueryNode = Schema.Schema.Type<typeof WorkflowQueryNodeV2>;
type MutationNode = Schema.Schema.Type<typeof WorkflowMutationNodeV2>;
type AgentNode = Schema.Schema.Type<typeof WorkflowAgentNodeV2>;
type DelayNode = Schema.Schema.Type<typeof WorkflowDelayNodeV2>;
type EventNode = Schema.Schema.Type<typeof WorkflowEventNodeV2>;
type SubworkflowNode = Schema.Schema.Type<typeof WorkflowSubworkflowNodeV2>;
type OutputNode = Schema.Schema.Type<typeof WorkflowOutputNodeV2>;

type IndependentQueryNode = Extract<
  QueryNode,
  { readonly transaction: { readonly kind: "independent" } }
>;
type InlineQueryNode = Extract<
  QueryNode,
  { readonly transaction: { readonly kind: "inline" } }
>;
type IndependentMutationNode = Extract<
  MutationNode,
  { readonly transaction: { readonly kind: "independent" } }
>;
type InlineMutationNode = Extract<
  MutationNode,
  { readonly transaction: { readonly kind: "inline" } }
>;

export const workflowNode = {
  source: (input: SourceNode): SourceNode => input,
  action: (input: ActionNode): ActionNode => input,
  query: (
    input: Omit<IndependentQueryNode, "transaction">,
  ): IndependentQueryNode => ({
    ...input,
    transaction: { kind: "independent" },
  }),
  inlineQuery: (
    input: Omit<InlineQueryNode, "transaction">,
    preset: InlineTransactionPresetName,
  ): InlineQueryNode => ({
    ...input,
    transaction: inlineTransactionPreset(preset),
  }),
  mutation: (
    input: Omit<IndependentMutationNode, "transaction">,
  ): IndependentMutationNode => ({
    ...input,
    transaction: { kind: "independent" },
  }),
  inlineMutation: (
    input: Omit<InlineMutationNode, "transaction">,
    preset: InlineTransactionPresetName,
  ): InlineMutationNode => ({
    ...input,
    transaction: inlineTransactionPreset(preset),
  }),
  advanced: {
    inlineQuery: (
      input: Omit<InlineQueryNode, "transaction">,
      transaction: ReviewedInlineTransaction,
    ): InlineQueryNode => ({ ...input, transaction }),
    inlineMutation: (
      input: Omit<InlineMutationNode, "transaction">,
      transaction: ReviewedInlineTransaction,
    ): InlineMutationNode => ({ ...input, transaction }),
  },
  agent: (input: AgentNode): AgentNode => input,
  delay: (input: DelayNode): DelayNode => input,
  event: (input: EventNode): EventNode => input,
  subworkflow: (input: Omit<SubworkflowNode, "schedule">): SubworkflowNode =>
    input,
  output: (input: OutputNode): OutputNode => input,
} as const;

export type DefineWorkflowGraphV2Input = Omit<
  DurableWorkflowGraphV2,
  "schemaVersion" | "kickoffProfiles" | "unstableArgs"
> & {
  readonly kickoffProfiles?: DurableWorkflowGraphV2["kickoffProfiles"];
  readonly unstableArgs?: DurableWorkflowGraphV2["unstableArgs"];
};

export class WorkflowGraphBuilderError extends Data.TaggedError(
  "WorkflowGraphBuilderError",
)<{
  readonly findings: readonly WorkflowGraphV2Finding[];
}> {}

export const defineWorkflowGraphV2 = (
  input: DefineWorkflowGraphV2Input,
): Result.Result<DurableWorkflowGraphV2, WorkflowGraphBuilderError> => {
  const unsupportedFailurePolicies = (
    input.nodes as readonly Readonly<Record<string, unknown>>[]
  ).flatMap((node) => {
    const finding = unsupportedWorkflowFailurePolicyFinding(node);
    return finding === undefined ? [] : [finding];
  });
  if (unsupportedFailurePolicies.length > 0) {
    return Result.fail(
      new WorkflowGraphBuilderError({
        findings: unsupportedFailurePolicies,
      }),
    );
  }
  const decoded = decodeDurableWorkflowGraphV2({
    ...input,
    schemaVersion: 2,
    kickoffProfiles: input.kickoffProfiles ?? [DEFAULT_INTERACTIVE_PROFILE],
    unstableArgs: input.unstableArgs ?? { enabled: false },
  });
  if (Exit.isFailure(decoded)) {
    return Result.fail(
      new WorkflowGraphBuilderError({
        findings: ["V2 graph schema mismatch"],
      }),
    );
  }

  const findings = validateWorkflowGraphV2(decoded.value);
  return findings.length === 0
    ? Result.succeed(decoded.value)
    : Result.fail(new WorkflowGraphBuilderError({ findings }));
};

const DEFAULT_INTERACTIVE_PROFILE = {
  name: "interactive",
  mode: "eager-first-poll",
  default: true,
} as const;

export type WorkflowStepInstance =
  | { readonly kind: "identity"; readonly value: string }
  | { readonly kind: "ordinal"; readonly value: number };

const WorkflowStepInstanceSuffix = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^(?:n\d{6,}|k\d+-[a-z0-9]+(?:-[a-z0-9]+)*)$/)),
);

export const deriveWorkflowStepInstanceSuffix = (
  instance: WorkflowStepInstance,
): string => {
  if (instance.kind === "ordinal") {
    return Schema.decodeSync(WorkflowStepInstanceSuffix)(
      `n${String(instance.value).padStart(6, "0")}`,
    );
  }
  return Schema.decodeSync(WorkflowStepInstanceSuffix)(
    `k${instance.value.length}-${instance.value}`,
  );
};

export const stableWorkflowStepName = ({
  name,
  version,
  instanceSuffix,
}: {
  readonly name: string;
  readonly version: number;
  readonly instanceSuffix?: string;
}): WorkflowStepNameType =>
  Schema.decodeSync(WorkflowStepName)(
    `${name}.v${version}${instanceSuffix ? `.i-${instanceSuffix}` : ""}`,
  );
