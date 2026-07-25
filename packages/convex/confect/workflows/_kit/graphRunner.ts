import type { FunctionReference } from "convex/server";

import {
  type DurableWorkflowGraph,
  type DurableWorkflowGraphV2,
  type WorkflowNode,
  validateWorkflowGraphV2,
} from "../graph";
import { makePublicError } from "../../shared/errors";
import {
  readStartNode,
  runGraphExecution,
  validateGraphOrThrow,
} from "./graphRunnerExecution";
import { preflightCapabilityRegistry } from "./graphRunnerNodes";
import { type ObservedWorkflowStageRefs } from "./observedStage";
import {
  runCompiledDurableGraphWorkflowV2,
  type RunDurableGraphV2CompilerInput,
} from "./graphRunnerV2";

export type {
  WorkflowEffectAdmission,
  WorkflowV2ActionCapabilityEntry,
  WorkflowV2CapabilityEntry,
  WorkflowV2CapabilityEnvelope,
  WorkflowSettledFailure,
  WorkflowSettledFailureRoute,
} from "./graphRunnerV2";

export type DurableGraphStepKind = "query" | "mutation" | "action";

export type DurableGraphStepRef<
  Kind extends DurableGraphStepKind = DurableGraphStepKind,
> = FunctionReference<Kind, "internal">;

export type DurableGraphCapabilityEnvelope = {
  readonly inputs: unknown;
  readonly context: Readonly<Record<string, unknown>>;
  readonly node: WorkflowNode;
  readonly policySnapshot: unknown;
};

export type DurableGraphCapabilityEntry<
  Kind extends DurableGraphStepKind = DurableGraphStepKind,
> = {
  readonly kind: Kind;
  readonly ref: DurableGraphStepRef<Kind>;
  readonly agentSeat?: true;
  readonly buildArgs?: (
    envelope: DurableGraphCapabilityEnvelope,
  ) => Record<string, unknown>;
};

export type RunDurableGraphInput = {
  readonly graph: DurableWorkflowGraph;
  readonly inputs: unknown;
  readonly policySnapshot: unknown;
  readonly capabilityRegistry: Readonly<
    Record<string, DurableGraphCapabilityEntry>
  >;
  readonly projectOutput?: (
    envelope: DurableGraphCapabilityEnvelope,
  ) => Record<string, unknown>;
  readonly observability?: ObservedWorkflowStageRefs & {
    readonly workflowRunId?: string;
    readonly componentWorkflowId?: string;
  };
};

export type RunDurableGraphStep = {
  readonly runQuery: (
    ref: DurableGraphStepRef<"query">,
    args: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly runMutation: (
    ref: DurableGraphStepRef<"mutation">,
    args: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly runAction: (
    ref: DurableGraphStepRef<"action">,
    args: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly sleep: (
    delayMs: number,
    options?: { readonly name?: string },
  ) => Promise<void>;
  readonly awaitEvent: <Result = unknown>(event: {
    readonly name: string;
  }) => Promise<Result>;
};

export const runDurableGraphWorkflow = async (
  step: RunDurableGraphStep,
  input: RunDurableGraphInput,
): Promise<Readonly<Record<string, unknown>>> => {
  validateGraphOrThrow(input.graph);
  const startNode = readStartNode(input.graph);
  preflightCapabilityRegistry(input.graph, input.capabilityRegistry);
  return runGraphExecution(step, input, startNode);
};

export type RunDurableGraphV2Input<
  Result extends Record<string, unknown> = Readonly<Record<string, unknown>>,
> = {
  readonly graph: DurableWorkflowGraphV2;
  readonly inputs: unknown;
  readonly principal: unknown;
  readonly policySnapshot: unknown;
  readonly projectOutput: (input: {
    readonly context: Readonly<Record<string, unknown>>;
  }) => Result;
} & Partial<
  Omit<
    RunDurableGraphV2CompilerInput<Result>,
    "graph" | "inputs" | "principal" | "policySnapshot" | "projectOutput"
  >
>;

/**
 * V2 bootstrap runner. WP-1.2+ add executable node compilers serially; WP-1.1
 * intentionally accepts only the generated source-to-output starter graph.
 */
export const runDurableGraphWorkflowV2 = async <
  Result extends Record<string, unknown>,
>(
  step: RunDurableGraphStep,
  input: RunDurableGraphV2Input<Result>,
): Promise<Result> => {
  const findings = validateWorkflowGraphV2(input.graph);
  if (findings.length > 0) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow graph V2 failed validation.",
      { findings: JSON.stringify(findings) },
    );
  }
  const executable = input.graph.nodes.filter(
    (node) => node.kind !== "source" && node.kind !== "output",
  );
  if (
    executable.length > 0 &&
    (!input.capabilityRegistry || !input.effectIdentity || !input.admitEffect)
  ) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow graph V2 contains a node whose compiler is not enabled yet.",
      { nodeIds: executable.map(({ id }) => id).join(",") },
    );
  }
  if (executable.length === 0) return input.projectOutput({ context: {} });
  const capabilityRegistry = input.capabilityRegistry;
  const effectIdentity = input.effectIdentity;
  const admitEffect = input.admitEffect;
  if (!capabilityRegistry || !effectIdentity || !admitEffect) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow graph V2 executable compiler inputs are incomplete.",
    );
  }
  return runCompiledDurableGraphWorkflowV2(step, {
    ...input,
    capabilityRegistry,
    effectIdentity,
    admitEffect,
  });
};
