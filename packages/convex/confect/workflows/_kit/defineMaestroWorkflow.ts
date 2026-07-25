import {
  validateWorkflowSemanticCoverage,
  type WorkflowSemanticCoverageEvidence,
  type WorkflowSemanticRuleId,
} from "@maestro-template/template-core/workflow-semantics";
import { WorkflowManager, type WorkflowComponent } from "@convex-dev/workflow";
import type { PropertyValidators, Validator } from "convex/values";
import * as Data from "effect/Data";
import * as Either from "effect/Either";

import type { WorkflowPolicyPosture } from "./policySnapshot";
import { generatedWorkflowWorkpoolOptions } from "./workpoolConfig";

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

export const planMaestroWorkflowDefinition = <
  Args extends PropertyValidators,
  Returns extends Validator<unknown, "required", string>,
>(
  definition: MaestroWorkflowDefinition<Args, Returns>,
  metadata: MaestroWorkflowMetadata,
): Either.Either<
  PlannedMaestroWorkflowDefinition<Args, Returns>,
  MaestroWorkflowDefinitionError
> => {
  const findings = validateDefinition(definition, metadata);
  return findings.length > 0
    ? Either.left(new MaestroWorkflowDefinitionError({ findings }))
    : Either.right({
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
  const planned = Either.getOrThrow(
    planMaestroWorkflowDefinition(definition, metadata),
  );
  const manager = new WorkflowManager(component, {
    workpoolOptions: planned.definition.workpoolOptions,
  });
  return manager.define({
    args: planned.definition.args,
    returns: planned.definition.returns,
  });
};

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
