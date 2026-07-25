import type { FunctionReference } from "convex/server";
import { getConvexSize } from "convex/values";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
import { WorkflowReference, type WorkflowNodeV2 } from "../graph";
import { assertJsonSafe } from "./graphRunnerJson";
import type { RunDurableGraphStep } from "./graphRunner";
import {
  WorkflowPrincipal,
  hasReservedWorkflowIdentityField,
  type WorkflowPrincipal as WorkflowPrincipalType,
} from "./principal";

type SubworkflowNodeV2 = Extract<WorkflowNodeV2, { kind: "subworkflow" }>;
type MappedChildArgs = Readonly<Record<string, unknown>>;
type ChildWorkflowArgs = MappedChildArgs & {
  readonly principal: WorkflowPrincipalType;
};
export type AnyChildWorkflowArgs = ChildWorkflowArgs;

export type DurableGraphWorkflowRef<
  Args extends ChildWorkflowArgs,
  Result,
> = FunctionReference<"mutation", "internal", { args: Args }, Result>;

export type WorkflowV2SubworkflowEnvelope = {
  readonly inputs: unknown;
  readonly context: Readonly<Record<string, unknown>>;
  readonly principal: WorkflowPrincipalType;
  readonly policySnapshot: unknown;
};

export type WorkflowV2SubworkflowRegistryEntry<
  Args extends ChildWorkflowArgs,
  Result,
> = {
  readonly version: number;
  readonly ref: DurableGraphWorkflowRef<Args, Result>;
  readonly mapArgs: (
    envelope: WorkflowV2SubworkflowEnvelope,
  ) => Omit<Args, "principal">;
  readonly resultSchema: Schema.Schema<Result>;
  readonly principal:
    | { readonly kind: "inherit" }
    | { readonly kind: "narrow"; readonly grants: readonly string[] };
  readonly lifecycle: {
    readonly cancel: "cascade";
    readonly cleanup: "cascade-async";
  };
};

export type AnyWorkflowV2SubworkflowRegistryEntry = {
  readonly version: number;
  readonly ref: DurableGraphWorkflowRef<AnyChildWorkflowArgs, unknown>;
  readonly mapArgs: (
    envelope: WorkflowV2SubworkflowEnvelope,
  ) => MappedChildArgs;
  readonly resultSchema: Schema.Schema.AnyNoContext;
  readonly principal: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["principal"];
  readonly lifecycle: WorkflowV2SubworkflowRegistryEntry<
    ChildWorkflowArgs,
    unknown
  >["lifecycle"];
};

export const defineWorkflowV2Subworkflow = <
  Args extends ChildWorkflowArgs,
  Result,
>(
  entry: WorkflowV2SubworkflowRegistryEntry<Args, Result>,
): WorkflowV2SubworkflowRegistryEntry<Args, Result> => entry;

export const defineWorkflowV2SubworkflowRegistry = <
  const Registry extends Readonly<
    Record<string, AnyWorkflowV2SubworkflowRegistryEntry>
  >,
>(
  registry: Registry,
): Registry => {
  for (const [key, entry] of Object.entries(registry)) {
    const decoded = Schema.decodeUnknownEither(WorkflowReference)(key);
    if (Either.isLeft(decoded) || !key.endsWith(`.v${entry.version}`)) {
      throw makePublicError(
        "VALIDATION_FAILED",
        "Subworkflow registry key must be a generated reference matching its immutable version.",
        { key, version: entry.version },
      );
    }
  }
  return registry;
};

type RunSubworkflowInput<Entry> = {
  readonly step: RunDurableGraphStep;
  readonly node: SubworkflowNodeV2;
  readonly entry: Entry;
  readonly inputs: unknown;
  readonly context: Readonly<Record<string, unknown>>;
  readonly principal: unknown;
  readonly policySnapshot: unknown;
};

export function runRegisteredSubworkflow<
  Args extends ChildWorkflowArgs,
  Result,
>(
  input: RunSubworkflowInput<WorkflowV2SubworkflowRegistryEntry<Args, Result>>,
): Promise<Result>;
export function runRegisteredSubworkflow(
  input: RunSubworkflowInput<AnyWorkflowV2SubworkflowRegistryEntry>,
): Promise<unknown>;
export async function runRegisteredSubworkflow({
  step,
  node,
  entry,
  inputs,
  context,
  principal,
  policySnapshot,
}: RunSubworkflowInput<AnyWorkflowV2SubworkflowRegistryEntry>): Promise<unknown> {
  if (entry.version !== node.childVersion) {
    throw subworkflowFailure(
      node,
      `registry binds child version ${entry.version}, not immutable graph version ${node.childVersion}`,
    );
  }
  if (!Number.isInteger(node.childVersion) || node.childVersion < 1) {
    throw subworkflowFailure(node, "childVersion must be a positive integer");
  }
  if (!step.runWorkflow) {
    throw subworkflowFailure(node, "runWorkflow is unavailable in this runner");
  }
  const parentPrincipal = decodePrincipal(node, principal);
  const childPrincipal = resolveChildPrincipal(
    node,
    parentPrincipal,
    entry.principal,
  );
  const mappedArgs = entry.mapArgs({
    inputs,
    context,
    principal: childPrincipal,
    policySnapshot,
  });
  assertJsonSafe(mappedArgs, `Subworkflow ${node.id} mapped invalid args.`);
  if (hasReservedWorkflowIdentityField(mappedArgs)) {
    throw subworkflowFailure(
      node,
      "mapped args cannot override reserved workflow identity fields",
    );
  }
  const childArgs = { ...mappedArgs, principal: childPrincipal };
  assertMappedArgsSize(node, childArgs);
  const rawResult = await step.runWorkflow(entry.ref, childArgs, {
    name: node.stepName,
  });
  const decoded = Schema.decodeUnknownEither(entry.resultSchema)(rawResult);
  if (Either.isLeft(decoded)) {
    throw subworkflowFailure(node, "child returned an invalid declared result");
  }
  return decoded.right;
}

export const scheduledSubworkflowFinding = (
  node: unknown,
): string | undefined => {
  if (!isRecord(node) || node.kind !== "subworkflow" || !("schedule" in node)) {
    return undefined;
  }
  const nodeId = typeof node.id === "string" ? node.id : "unknown";
  return `subworkflow node ${nodeId} cannot use runAt or runAfter on pinned Workflow 0.4.4 because runWorkflow drops scheduled-child options; use a named sleep followed by an unscheduled child as a deliberately non-equivalent alternative, or a tested compatible upgrade`;
};

const decodePrincipal = (
  node: SubworkflowNodeV2,
  principal: unknown,
): WorkflowPrincipalType => {
  const decoded = Schema.decodeUnknownEither(WorkflowPrincipal)(principal);
  if (Either.isLeft(decoded)) {
    throw subworkflowFailure(node, "parent principal is invalid");
  }
  return decoded.right;
};

const resolveChildPrincipal = (
  node: SubworkflowNodeV2,
  parent: WorkflowPrincipalType,
  policy: AnyWorkflowV2SubworkflowRegistryEntry["principal"],
): WorkflowPrincipalType => {
  if (policy.kind === "inherit") return parent;
  const parentGrants = new Set(parent.grants);
  if (policy.grants.some((grant) => !parentGrants.has(grant))) {
    throw subworkflowFailure(
      node,
      "narrowed child principal cannot add grants",
    );
  }
  return { ...parent, grants: [...policy.grants] };
};

const assertMappedArgsSize = (node: SubworkflowNodeV2, args: unknown): void => {
  const budget = Math.min(node.payloadPolicy.maxInputBytes, 1_000_000);
  if (!Number.isFinite(budget) || budget < 0) {
    throw subworkflowFailure(
      node,
      "mapped args budget must be finite and nonnegative",
    );
  }
  assertJsonSafe(args, `Subworkflow ${node.id} mapped invalid args.`);
  const size = getConvexSize(args);
  if (size > budget) {
    throw subworkflowFailure(
      node,
      `mapped args use ${size} bytes above the ${budget} bytes limit`,
    );
  }
};

const subworkflowFailure = (node: SubworkflowNodeV2, issue: string) =>
  makePublicError(
    "VALIDATION_FAILED",
    `Workflow subworkflow compilation failed at ${node.id} (${node.stepName}): ${issue}`,
    { nodeId: node.id, stepName: node.stepName, issue },
  );

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
