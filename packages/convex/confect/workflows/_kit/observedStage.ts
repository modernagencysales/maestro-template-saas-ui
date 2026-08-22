import type { FunctionReference } from "convex/server";
import * as Exit from "effect/Exit";

import type { WorkflowNodeKind } from "../graph";
import {
  recordStageFailed,
  recordStageStarted,
  recordStageSucceeded,
} from "./observedStagePayload";
import type { SubworkflowExecutionContext } from "./subworkflows";
import {
  decodeObservedWorkflowAuthority,
  type ObservedWorkflowAuthority,
} from "./observedAuthority";

export type { ObservedWorkflowAuthority } from "./observedAuthority";

type StageMutationRef = FunctionReference<"mutation", "internal">;
type ExecutionIdentityRef = FunctionReference<"query", "internal">;
type SubworkflowActivationRef = FunctionReference<"mutation", "internal">;

export type ObservedWorkflowExecutionIdentity = {
  readonly generation: number;
  readonly observedAt: number;
  readonly authority?: ObservedWorkflowAuthority;
};

export type ObservedWorkflowStageRefs = {
  readonly recordStageStarted?: StageMutationRef;
  readonly recordStageFinished?: StageMutationRef;
};

export type ObservedWorkflowStageStep = {
  readonly runMutation: (
    ref: StageMutationRef,
    args: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
};

export const loadObservedWorkflowExecutionIdentity = async (
  step: {
    readonly workflowId?: string;
    readonly runQuery: (
      ref: ExecutionIdentityRef,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
    readonly runMutation: (
      ref: SubworkflowActivationRef,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
  },
  ref: ExecutionIdentityRef,
  input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly subworkflow?: SubworkflowExecutionContext;
    readonly activateSubworkflowRef?: SubworkflowActivationRef;
  },
) => {
  if (!step.workflowId) {
    throw new Error("Workflow component identity is unavailable.");
  }
  let authority: ObservedWorkflowAuthority | undefined;
  if (input.subworkflow !== undefined) {
    if (!input.activateSubworkflowRef) {
      throw new Error("Subworkflow activation binding is unavailable.");
    }
    const activated = await step.runMutation(input.activateSubworkflowRef, {
      workspaceId: input.workspaceId,
      parentWorkflowRunId: input.subworkflow.parentWorkflowRunId,
      parentComponentWorkflowId: input.subworkflow.parentComponentWorkflowId,
      childWorkflowRunId: input.workflowRunId,
      childComponentWorkflowId: step.workflowId,
      generation: input.subworkflow.generation,
      linkId: input.subworkflow.linkId,
      occurredAt: input.subworkflow.reservedAt,
    });
    authority = readObservedWorkflowAuthority(activated);
  } else if (input.activateSubworkflowRef !== undefined) {
    throw new Error("Subworkflow activation context is unavailable.");
  }
  const value = await step.runQuery(ref, {
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    componentWorkflowId: step.workflowId,
  });
  if (!isExecutionIdentity(value)) {
    throw new Error("Workflow execution identity is unavailable.");
  }
  return authority === undefined ? value : { ...value, authority };
};

export const bindObservedWorkflowAuthority = <
  Args extends {
    readonly principal: unknown;
    readonly policySnapshot: unknown;
  },
>(
  args: Args,
  identity: ObservedWorkflowExecutionIdentity,
): Args =>
  identity.authority === undefined
    ? args
    : {
        ...args,
        principal: identity.authority.principal,
        policySnapshot: identity.authority.policySnapshot,
      };

const readObservedWorkflowAuthority = (
  value: unknown,
): ObservedWorkflowAuthority => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Subworkflow reserved authority is unavailable.");
  }
  const decoded = decodeObservedWorkflowAuthority({
    principal: "principal" in value ? value.principal : undefined,
    policySnapshot:
      "policySnapshot" in value ? value.policySnapshot : undefined,
  });
  if (Exit.isFailure(decoded)) {
    throw new Error("Subworkflow reserved authority is unavailable.");
  }
  return decoded.value;
};

const isExecutionIdentity = (
  value: unknown,
): value is ObservedWorkflowExecutionIdentity =>
  typeof value === "object" &&
  value !== null &&
  "generation" in value &&
  typeof value.generation === "number" &&
  Number.isInteger(value.generation) &&
  value.generation >= 0 &&
  "observedAt" in value &&
  typeof value.observedAt === "number" &&
  Number.isFinite(value.observedAt) &&
  value.observedAt >= 0;

export type RunObservedWorkflowStageInput<Result> = {
  readonly step: ObservedWorkflowStageStep;
  readonly refs?: ObservedWorkflowStageRefs;
  readonly workflowRunId?: string;
  readonly componentWorkflowId?: string;
  readonly nodeId: string;
  readonly label: string;
  readonly kind: WorkflowNodeKind | "subworkflow" | "event";
  readonly stageKey?: string;
  readonly lifecycleGeneration?: number;
  readonly externalEffect?: boolean;
  readonly observedAt?: number;
  readonly attemptNumber?: number | "unknown";
  readonly order?: number;
  readonly run: () => Promise<Result>;
};

export const runObservedWorkflowStage = async <Result>(
  input: RunObservedWorkflowStageInput<Result>,
): Promise<Result> => {
  await recordStageStarted(input);

  try {
    const result = await input.run();
    await recordStageSucceeded(input, result);
    return result;
  } catch (error) {
    await recordStageFailed(input, error);
    throw error;
  }
};
