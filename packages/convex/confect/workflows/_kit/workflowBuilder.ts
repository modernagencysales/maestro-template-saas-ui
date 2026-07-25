import * as Data from "effect/Data";
import * as Either from "effect/Either";
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
  inlineQuery: (input: InlineQueryNode): InlineQueryNode => input,
  mutation: (
    input: Omit<IndependentMutationNode, "transaction">,
  ): IndependentMutationNode => ({
    ...input,
    transaction: { kind: "independent" },
  }),
  inlineMutation: (input: InlineMutationNode): InlineMutationNode => input,
  agent: (input: AgentNode): AgentNode => input,
  delay: (input: DelayNode): DelayNode => input,
  event: (input: EventNode): EventNode => input,
  subworkflow: (input: SubworkflowNode): SubworkflowNode => input,
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
  readonly findings: readonly string[];
}> {}

export const defineWorkflowGraphV2 = (
  input: DefineWorkflowGraphV2Input,
): Either.Either<DurableWorkflowGraphV2, WorkflowGraphBuilderError> => {
  const decoded = decodeDurableWorkflowGraphV2({
    ...input,
    schemaVersion: 2,
    kickoffProfiles: input.kickoffProfiles ?? [DEFAULT_INTERACTIVE_PROFILE],
    unstableArgs: input.unstableArgs ?? { enabled: false },
  });
  if (Either.isLeft(decoded)) {
    return Either.left(
      new WorkflowGraphBuilderError({
        findings: [`V2 graph schema mismatch: ${String(decoded.left)}`],
      }),
    );
  }

  const findings = validateWorkflowGraphV2(decoded.right);
  return findings.length === 0
    ? Either.right(decoded.right)
    : Either.left(new WorkflowGraphBuilderError({ findings }));
};

const DEFAULT_INTERACTIVE_PROFILE = {
  name: "interactive",
  mode: "eager-first-poll",
  default: true,
} as const;
