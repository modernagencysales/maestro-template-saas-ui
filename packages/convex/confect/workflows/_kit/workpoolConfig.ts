import type { LogLevel, WorkpoolOptions } from "@convex-dev/workpool";

import { readNodeEnvironment } from "../../shared/env";

export type WorkflowEnvironment = "development" | "test" | "production";

export type WorkflowWorkpoolDeclaration = {
  readonly component: string;
  readonly options: WorkpoolOptions;
};

const environmentPosture: Readonly<
  Record<
    WorkflowEnvironment,
    { readonly maxParallelism: number; readonly logLevel: LogLevel }
  >
> = {
  development: { maxParallelism: 8, logLevel: "INFO" },
  test: { maxParallelism: 4, logLevel: "WARN" },
  production: { maxParallelism: 20, logLevel: "REPORT" },
};

export const workflowWorkpoolOptions = (
  environment: WorkflowEnvironment,
): WorkpoolOptions => ({
  ...environmentPosture[environment],
  retryActionsByDefault: false,
});

const nodeEnvironment = readNodeEnvironment();

const generatedWorkflowEnvironment: WorkflowEnvironment =
  nodeEnvironment === "production"
    ? "production"
    : nodeEnvironment === "test"
      ? "test"
      : "development";

export const generatedWorkflowWorkpoolOptions = workflowWorkpoolOptions(
  generatedWorkflowEnvironment,
);

export const generatedWorkflowReadyWaveLimit =
  environmentPosture[generatedWorkflowEnvironment].maxParallelism;

export const generatedWorkflowSubworkflowPolicy = {
  maxDepth: 8,
  maxFanOut:
    environmentPosture[generatedWorkflowEnvironment].maxParallelism * 4,
} as const;

export const workflowWorkpoolConfigurationFindings = (
  environment: WorkflowEnvironment,
  declarations: readonly WorkflowWorkpoolDeclaration[],
): readonly string[] => {
  const expected = workflowWorkpoolOptions(environment);
  return declarations.flatMap(({ component, options }) =>
    options.maxParallelism === expected.maxParallelism &&
    options.logLevel === expected.logLevel &&
    options.retryActionsByDefault === expected.retryActionsByDefault
      ? []
      : [
          `${component}: Workpool configuration conflicts with the ${environment} workflow budget`,
        ],
  );
};
