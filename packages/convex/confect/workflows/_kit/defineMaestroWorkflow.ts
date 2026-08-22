import {
  validateWorkflowSemanticCoverage,
  type WorkflowSemanticCoverageEvidence,
  type WorkflowSemanticRuleId,
} from "@maestro-template/template-core/workflow-semantics";
import {
  defineEvent,
  getStatus,
  sendEvent,
  WorkflowManager,
  type EventId,
  type WorkflowComponent,
  type WorkflowId,
  vWorkflowId,
  vResultValidator,
} from "@convex-dev/workflow";
import type { PropertyValidators, Validator } from "convex/values";
import * as Data from "effect/Data";
import * as Result from "effect/Result";

import type { WorkflowPolicyPosture } from "./policySnapshot";
import { generatedWorkflowWorkpoolOptions } from "./workpoolConfig";

export const defineMaestroWorkflowEvent = defineEvent;
export const sendMaestroWorkflowEvent = sendEvent;
export const getMaestroWorkflowStatus = getStatus;
export const MaestroWorkflowIdValidator = vWorkflowId;
export const MaestroWorkflowResultValidator = vResultValidator;
export type MaestroWorkflowComponent = WorkflowComponent;
export type MaestroWorkflowEventId<Name extends string = string> =
  EventId<Name>;
export type MaestroWorkflowId = WorkflowId;

export type WorkflowKickoffProfile = {
  readonly name: string;
  readonly mode: "eager-first-poll" | "queued";
  readonly default: boolean;
};

export type MaestroWorkflowMetadata = {
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly runtimeVersion: string;
  readonly argsSchemaName: string;
  readonly returnSchemaName: string;
  readonly principalSchemaName: string;
  readonly policyPosture: WorkflowPolicyPosture;
  readonly kickoffProfiles: readonly WorkflowKickoffProfile[];
  readonly semanticRuleIds: readonly WorkflowSemanticRuleId[];
  readonly semanticCoverage: Partial<
    Record<WorkflowSemanticRuleId, WorkflowSemanticCoverageEvidence>
  >;
  readonly unstableArgsAdr?: string;
};

export type MaestroWorkflowDefinition<
  Args extends PropertyValidators,
  Returns extends Validator<unknown, "required", string>,
> = {
  readonly args: Args;
  readonly returns: Returns;
};

export type PlannedMaestroWorkflowDefinition<
  Args extends PropertyValidators,
  Returns extends Validator<unknown, "required", string>,
> = {
  readonly definition: MaestroWorkflowDefinition<Args, Returns> & {
    readonly workpoolOptions: typeof generatedWorkflowWorkpoolOptions;
  };
  readonly metadata: MaestroWorkflowMetadata;
};

export class MaestroWorkflowDefinitionError extends Data.TaggedError(
  "MaestroWorkflowDefinitionError",
)<{
  readonly findings: readonly string[];
}> {}

export type MaestroWorkflowRestartOptions = {
  readonly from: 0 | string;
  readonly startAsync: true;
};

export type MaestroWorkflowLifecycleManager<Context> = {
  readonly status: (
    context: Context,
    workflowId: string,
  ) => Promise<{
    readonly type: "inProgress" | "completed" | "failed" | "canceled";
  }>;
  readonly cancel: (context: Context, workflowId: string) => Promise<void>;
  readonly restart: (
    context: Context,
    workflowId: string,
    options: MaestroWorkflowRestartOptions,
  ) => Promise<void>;
  readonly cleanup: (context: Context, workflowId: string) => Promise<boolean>;
};

export const bindMaestroWorkflowLifecycleManager = <Context>(
  context: Context,
  manager: MaestroWorkflowLifecycleManager<Context>,
) => ({
  status: (componentWorkflowId: string) =>
    manager.status(context, componentWorkflowId),
  cancel: (componentWorkflowId: string) =>
    manager.cancel(context, componentWorkflowId),
  restart: (
    componentWorkflowId: string,
    options: MaestroWorkflowRestartOptions,
  ) => manager.restart(context, componentWorkflowId, options),
  cleanup: (componentWorkflowId: string) =>
    manager.cleanup(context, componentWorkflowId),
});

type WorkflowLifecycleContext = Parameters<WorkflowManager["cancel"]>[0];

export const createMaestroWorkflowLifecycleAdapter = (
  component: WorkflowComponent,
  context: WorkflowLifecycleContext,
) => {
  const manager = createMaestroWorkflowManager(component);
  return bindMaestroWorkflowLifecycleManager(context, {
    status: (managerContext, workflowId) =>
      manager.status(managerContext, workflowId as WorkflowId),
    cancel: (managerContext, workflowId) =>
      manager.cancel(managerContext, workflowId as WorkflowId),
    restart: (managerContext, workflowId, options) =>
      manager.restart(managerContext, workflowId as WorkflowId, options),
    cleanup: (managerContext, workflowId) =>
      manager.cleanup(managerContext, workflowId as WorkflowId),
  });
};

export const planMaestroWorkflowDefinition = <
  Args extends PropertyValidators,
  Returns extends Validator<unknown, "required", string>,
>(
  definition: MaestroWorkflowDefinition<Args, Returns>,
  metadata: MaestroWorkflowMetadata,
): Result.Result<
  PlannedMaestroWorkflowDefinition<Args, Returns>,
  MaestroWorkflowDefinitionError
> => {
  const findings = validateDefinition(definition, metadata);
  return findings.length > 0
    ? Result.fail(new MaestroWorkflowDefinitionError({ findings }))
    : Result.succeed({
        definition: {
          ...definition,
          workpoolOptions: generatedWorkflowWorkpoolOptions,
        },
        metadata,
      });
};

/** Sole application-facing workflow definition boundary. */
export const defineMaestroWorkflow = <
  Args extends PropertyValidators,
  Returns extends Validator<unknown, "required", string>,
>(
  component: WorkflowComponent,
  definition: MaestroWorkflowDefinition<Args, Returns>,
  metadata: MaestroWorkflowMetadata,
) => {
  const planned = Result.getOrThrow(
    planMaestroWorkflowDefinition(definition, metadata),
  );
  const manager = createMaestroWorkflowManager(
    component,
    planned.definition.workpoolOptions,
  );
  return manager.define({
    args: planned.definition.args,
    returns: planned.definition.returns,
  });
};

const createMaestroWorkflowManager = (
  component: WorkflowComponent,
  workpoolOptions = generatedWorkflowWorkpoolOptions,
) => new WorkflowManager(component, { workpoolOptions });

const validateDefinition = <
  Args extends PropertyValidators,
  Returns extends Validator<unknown, "required", string>,
>(
  definition: MaestroWorkflowDefinition<Args, Returns>,
  metadata: MaestroWorkflowMetadata,
): readonly string[] => [
  ...(definition.returns.kind === "any"
    ? ["return validator cannot be v.any"]
    : []),
  ...requiredMetadataFindings(metadata),
  ...kickoffProfileFindings(metadata.kickoffProfiles),
  ...validateWorkflowSemanticCoverage(metadata.semanticCoverage),
  ...metadata.semanticRuleIds
    .filter((id) => metadata.semanticCoverage[id] === undefined)
    .map((id) => `${id}: missing semantic evidence`),
];

const requiredMetadataFindings = (
  metadata: MaestroWorkflowMetadata,
): readonly string[] =>
  [
    ["workflowId", metadata.workflowId],
    ["runtimeVersion", metadata.runtimeVersion],
    ["argsSchemaName", metadata.argsSchemaName],
    ["returnSchemaName", metadata.returnSchemaName],
    ["principalSchemaName", metadata.principalSchemaName],
  ].flatMap(([field, value]) =>
    value === undefined || value.trim().length === 0
      ? [`${field}: required`]
      : [],
  );

const kickoffProfileFindings = (
  profiles: readonly WorkflowKickoffProfile[],
): readonly string[] => {
  const defaults = profiles.filter((profile) => profile.default);
  const names = new Set(profiles.map((profile) => profile.name));
  return [
    ...(defaults.length === 1
      ? []
      : ["exactly one default kickoff profile is required"]),
    ...(defaults[0]?.mode === "eager-first-poll"
      ? []
      : ["default kickoff profile must use eager-first-poll"]),
    ...(names.size === profiles.length
      ? []
      : ["kickoff profile names must be unique"]),
  ];
};
