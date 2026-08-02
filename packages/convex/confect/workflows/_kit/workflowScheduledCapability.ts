import * as Result from "effect/Result";

import type { WorkflowScheduleInput } from "./workflowSchedule";
import {
  observeWorkflowDeadlineStart,
  type WorkflowDeadlineStartFacts,
} from "./workflowDeadline";

export type WorkflowScheduledCapabilityRequest = {
  readonly schemaVersion: 1;
  readonly requestedAt: number;
  readonly requestedSchedule: WorkflowScheduleInput;
  readonly requestedStartAt: number;
  readonly deadlineAt: number;
};

export type WorkflowScheduledCapabilityInvocation = {
  readonly request: WorkflowScheduledCapabilityRequest;
  readonly authority: {
    readonly principal: unknown;
    readonly policySnapshot: unknown;
  };
  readonly delegateArgs: Readonly<Record<string, unknown>>;
};

export type WorkflowScheduledCapabilityGate =
  | { readonly kind: "allow" }
  | { readonly kind: "deny"; readonly detail: string };

export type WorkflowScheduledCapabilityBlockReason =
  | "expired"
  | "principal-changed"
  | "policy-changed"
  | "business-expired"
  | "spend-denied";

export type WorkflowScheduledCapabilityResult<Result> =
  | {
      readonly kind: "dispatched";
      readonly facts: WorkflowDeadlineStartFacts;
      readonly result: Result;
    }
  | {
      readonly kind: "not-dispatched";
      readonly reason: WorkflowScheduledCapabilityBlockReason;
      readonly detail: string;
      readonly facts: WorkflowDeadlineStartFacts;
    };

export const buildWorkflowScheduledCapabilityInvocation = (input: {
  readonly requestedAt: number;
  readonly requestedSchedule: WorkflowScheduleInput;
  readonly deadlineAt: number;
  readonly principal: unknown;
  readonly policySnapshot: unknown;
  readonly delegateArgs: Readonly<Record<string, unknown>>;
}): WorkflowScheduledCapabilityInvocation => {
  assertTime(input.requestedAt, "requestedAt");
  assertTime(input.deadlineAt, "deadlineAt");
  const requestedStartAt =
    input.requestedSchedule.kind === "runAt"
      ? input.requestedSchedule.timestamp
      : input.requestedAt + input.requestedSchedule.delayMs;
  assertTime(requestedStartAt, "requestedStartAt");
  if (requestedStartAt < input.requestedAt) {
    throw new Error("Scheduled capability requested start is in the past.");
  }
  const request = Object.freeze({
    schemaVersion: 1 as const,
    requestedAt: input.requestedAt,
    requestedSchedule: Object.freeze({ ...input.requestedSchedule }),
    requestedStartAt,
    deadlineAt: input.deadlineAt,
  });
  return Object.freeze({
    request,
    authority: Object.freeze({
      principal: input.principal,
      policySnapshot: input.policySnapshot,
    }),
    delegateArgs: Object.freeze({ ...input.delegateArgs }),
  });
};

type RunScheduledWorkflowCapabilityInput<Result> = {
  readonly invocation: WorkflowScheduledCapabilityInvocation;
  /** Read inside the scheduled wrapper, after Workpool's wait has completed. */
  readonly actualStartNowMs: () => number;
  readonly recordActualStart: (
    facts: WorkflowDeadlineStartFacts,
  ) => Promise<void>;
  readonly recheckPrincipal: (
    invocation: WorkflowScheduledCapabilityInvocation,
  ) => Promise<WorkflowScheduledCapabilityGate>;
  readonly recheckPolicy: (
    invocation: WorkflowScheduledCapabilityInvocation,
  ) => Promise<WorkflowScheduledCapabilityGate>;
  readonly recheckBusinessExpiry: (
    invocation: WorkflowScheduledCapabilityInvocation,
    facts: WorkflowDeadlineStartFacts,
  ) => Promise<WorkflowScheduledCapabilityGate>;
  readonly recheckSpend: (
    invocation: WorkflowScheduledCapabilityInvocation,
  ) => Promise<WorkflowScheduledCapabilityGate>;
  readonly dispatch: (
    args: Readonly<Record<string, unknown>>,
  ) => Promise<Result>;
};

/**
 * Generated scheduled wrappers call this after the Workpool wait. The wrapper
 * owns the actual-start clock and all mutable admission checks; the outer graph
 * runner owns only the immutable request and not-before scheduling option.
 */
export const runScheduledWorkflowCapability = async <Result>(
  input: RunScheduledWorkflowCapabilityInput<Result>,
): Promise<WorkflowScheduledCapabilityResult<Result>> => {
  const observed = observeWorkflowDeadlineStart({
    requestedStartAt: input.invocation.request.requestedStartAt,
    actualStartedAt: input.actualStartNowMs(),
    deadlineAt: input.invocation.request.deadlineAt,
  });
  if (Result.isFailure(observed)) throw observed.failure;
  const facts = Object.freeze(observed.success);
  await input.recordActualStart(facts);
  if (facts.expired) {
    return blocked(
      "expired",
      "The immutable scheduled capability deadline elapsed before actual start.",
      facts,
    );
  }
  const principal = await input.recheckPrincipal(input.invocation);
  if (principal.kind === "deny") {
    return blocked("principal-changed", principal.detail, facts);
  }
  const policy = await input.recheckPolicy(input.invocation);
  if (policy.kind === "deny") {
    return blocked("policy-changed", policy.detail, facts);
  }
  const businessExpiry = await input.recheckBusinessExpiry(
    input.invocation,
    facts,
  );
  if (businessExpiry.kind === "deny") {
    return blocked("business-expired", businessExpiry.detail, facts);
  }
  const spend = await input.recheckSpend(input.invocation);
  if (spend.kind === "deny") {
    return blocked("spend-denied", spend.detail, facts);
  }
  return {
    kind: "dispatched",
    facts,
    result: await input.dispatch(input.invocation.delegateArgs),
  };
};

const blocked = (
  reason: WorkflowScheduledCapabilityBlockReason,
  detail: string,
  facts: WorkflowDeadlineStartFacts,
): WorkflowScheduledCapabilityResult<never> => ({
  kind: "not-dispatched",
  reason,
  detail,
  facts,
});

const assertTime = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `Scheduled capability ${label} must be a nonnegative safe integer.`,
    );
  }
};
