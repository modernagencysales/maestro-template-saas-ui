import type { FunctionReference } from "convex/server";
import {
  defineMaestroWorkflow,
  type MaestroWorkflowEventId as ComponentEventId,
  type MaestroWorkflowId as ComponentWorkflowId,
} from "./defineMaestroWorkflow";
type MaestroWorkflowHandler = Parameters<
  ReturnType<typeof defineMaestroWorkflow>["handler"]
>[0];
type MaestroWorkflowContext = Parameters<MaestroWorkflowHandler>[0];
import type { Validator } from "convex/values";

import type {
  DurableWorkflowGraph,
  DurableWorkflowGraphV2,
  WorkflowNode,
} from "../graphCurrent";
import { validateWorkflowGraphV2 } from "../graphCurrent";
import { makePublicError } from "../../shared/errors";
import {
  readStartNode,
  runGraphExecution,
  validateGraphOrThrow,
} from "./graphRunnerExecution";
import { preflightCapabilityRegistry } from "./graphRunnerNodes";
import { type ObservedWorkflowStageRefs } from "./observedStageCurrent";
import {
  runCompiledDurableGraphWorkflowV2,
  type RunDurableGraphV2CompilerInput,
} from "./graphRunnerV2Current";
import { validateWorkflowV2SubworkflowTopology } from "./subworkflowsCurrent";
import { PINNED_INLINE_CONVEX_VERSION } from "./inlineTransactions";
import type { WorkflowScheduleOptions } from "./workflowSchedule";

export type {
  WorkflowEffectAdmission,
  WorkflowV2ActionCapabilityEntry,
  WorkflowV2CapabilityEntry,
  WorkflowV2CapabilityEnvelope,
  WorkflowSettledFailure,
  WorkflowSettledFailureRoute,
} from "./graphRunnerV2Current";

export type DurableGraphStepKind = "query" | "mutation" | "action";

export type DurableGraphStepRef<
  Kind extends DurableGraphStepKind = DurableGraphStepKind,
> = FunctionReference<Kind, "internal">;
export type DurableGraphStepOptions = WorkflowScheduleOptions &
  Readonly<Record<string, unknown>>;
export type DurableGraphUnscheduledStepOptions = Readonly<
  Record<string, unknown>
> & {
  readonly runAt?: never;
  readonly runAfter?: never;
};

export type { DurableGraphWorkflowRef } from "./subworkflowsCurrent";
export type { ProductWorkflowEventId } from "./events";

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
  /** Exact component workflow identity supplied by Workflow 0.4.4. */
  readonly workflowId?: ComponentWorkflowId;
  runQuery(
    ref: DurableGraphStepRef<"query">,
    args: Record<string, unknown>,
    options?: DurableGraphStepOptions | DurableGraphUnscheduledStepOptions,
  ): Promise<unknown>;
  runMutation(
    ref: DurableGraphStepRef<"mutation">,
    args: Record<string, unknown>,
    options?: DurableGraphStepOptions | DurableGraphUnscheduledStepOptions,
  ): Promise<unknown>;
  runAction(
    ref: DurableGraphStepRef<"action">,
    args: Record<string, unknown>,
    options?: DurableGraphStepOptions | DurableGraphUnscheduledStepOptions,
  ): Promise<unknown>;
  readonly runWorkflow?: <
    Args extends import("./subworkflowsCurrent").AnyChildWorkflowArgs,
    Result,
  >(
    ref: import("./subworkflowsCurrent").DurableGraphWorkflowRef<Args, Result>,
    args: Args,
    options?: { readonly name?: string },
  ) => Promise<unknown>;
  readonly sleep: (
    delayMs: number,
    options?: { readonly name?: string },
  ) => Promise<void>;
  readonly awaitEvent: <Result = unknown, Name extends string = string>(
    event: (
      | { readonly name: Name; readonly id?: ComponentEventId<Name> }
      | { readonly name?: Name; readonly id: ComponentEventId<Name> }
    ) & {
      readonly validator?: Validator<Result, "required", string>;
    },
  ) => Promise<Result>;
};
/**
 * Checked adapter for the pinned Workflow 0.4.4 handler context. Keeping this
 * structural assignment executable in package typecheck prevents generated
 * runners from hiding option drift behind a whole-object assertion.
 */
export const adaptPinnedWorkflowStep = (
  step: MaestroWorkflowContext,
): RunDurableGraphStep => ({
  workflowId: step.workflowId,
  runQuery: (ref, args, options) =>
    options === undefined
      ? step.runQuery(ref, args)
      : step.runQuery(ref, args, options),
  runMutation: (ref, args, options) =>
    options === undefined
      ? step.runMutation(ref, args)
      : step.runMutation(ref, args, options),
  runAction: (ref, args, options) =>
    options === undefined
      ? step.runAction(ref, args)
      : step.runAction(ref, args, options),
  runWorkflow: (ref, args, options) => step.runWorkflow(ref, args, options),
  sleep: (delayMs, options) => step.sleep(delayMs, options),
  awaitEvent: (event) => step.awaitEvent(event),
});

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

/** Compiles the validated V2 graph into the pinned Workflow step primitives. */
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
  const subworkflowNodes = executable.filter(
    (node) =>
      node.kind === "subworkflow" || node.kind === "bounded-subworkflow-batch",
  );
  const eventNodes = executable.filter((node) => node.kind === "event");
  const capabilityNodes = executable.filter(
    (node) => node.kind === "capability",
  );
  if (
    capabilityNodes.length > 0 &&
    (!input.capabilityRegistry || !input.effectIdentity || !input.admitEffect)
  ) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow graph V2 contains a node whose compiler is not enabled yet.",
      { nodeIds: capabilityNodes.map(({ id }) => id).join(",") },
    );
  }
  if (eventNodes.length > 0 && !input.effectIdentity) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow graph V2 event allocation requires workflow ownership identity.",
      { nodeIds: eventNodes.map(({ id }) => id).join(",") },
    );
  }
  if (executable.length === 0) return input.projectOutput({ context: {} });
  if (subworkflowNodes.length > 0 && !input.workflowRegistry) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow graph V2 contains a subworkflow without a generated registry.",
      { nodeIds: subworkflowNodes.map(({ id }) => id).join(",") },
    );
  }
  if (
    subworkflowNodes.length > 0 &&
    (!input.subworkflowPolicy || !input.effectIdentity)
  ) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow graph V2 subworkflow ownership and topology policy are required.",
    );
  }
  if (
    subworkflowNodes.length > 0 &&
    input.workflowRegistry &&
    input.subworkflowPolicy
  ) {
    validateWorkflowV2SubworkflowTopology(
      input.graph,
      input.workflowRegistry,
      input.subworkflowPolicy,
    );
  }
  if (eventNodes.length > 0 && !input.eventRegistry) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow graph V2 contains an event without a generated registry.",
      { nodeIds: eventNodes.map(({ id }) => id).join(",") },
    );
  }
  const capabilityRegistry = input.capabilityRegistry ?? {};
  const effectIdentity = input.effectIdentity;
  const admitEffect =
    input.admitEffect ??
    (async () => ({ kind: "deny", reason: "not used" }) as const);
  if (!effectIdentity) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow graph V2 executable compiler inputs are incomplete.",
    );
  }
  return runCompiledDurableGraphWorkflowV2(step, {
    ...input,
    convexVersion: input.convexVersion ?? PINNED_INLINE_CONVEX_VERSION,
    capabilityRegistry,
    effectIdentity,
    admitEffect,
  });
};
