import type {
  WorkflowEnvironment,
  WorkflowWorkpoolDeclaration,
} from "./_kit/workpoolConfig";

type WorkpoolOptionsFactory = (
  environment: WorkflowEnvironment,
) => WorkflowWorkpoolDeclaration["options"];
type WorkpoolFindings = (
  environment: WorkflowEnvironment,
  declarations: readonly WorkflowWorkpoolDeclaration[],
) => readonly string[];

export const collectPublicationFixtureWorkflowWorkpoolDeclarations = (
  environment: WorkflowEnvironment,
  workflowWorkpoolOptions: WorkpoolOptionsFactory,
): readonly WorkflowWorkpoolDeclaration[] => [
  {
    component: "workflow",
    options: workflowWorkpoolOptions(environment),
  },
];

export const assertPublicationFixtureWorkflowPredeploy = (
  environment: WorkflowEnvironment,
  workflowWorkpoolOptions: WorkpoolOptionsFactory,
  workflowWorkpoolConfigurationFindings: WorkpoolFindings,
  additionalComponentDeclarations: readonly WorkflowWorkpoolDeclaration[] = [],
): readonly WorkflowWorkpoolDeclaration[] => {
  const declarations = [
    ...additionalComponentDeclarations,
    ...collectPublicationFixtureWorkflowWorkpoolDeclarations(
      environment,
      workflowWorkpoolOptions,
    ),
  ];
  const findings = workflowWorkpoolConfigurationFindings(
    environment,
    declarations,
  );
  if (findings.length > 0) {
    throw new Error(
      `Workflow predeploy generation failed:\n${findings.join("\n")}`,
    );
  }
  return declarations;
};
