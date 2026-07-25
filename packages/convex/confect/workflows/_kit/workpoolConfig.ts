import type { LogLevel, WorkpoolOptions } from "@convex-dev/workpool";

export type WorkflowEnvironment = "development" | "test" | "production";

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

export const generatedWorkflowWorkpoolOptions = workflowWorkpoolOptions(
  process.env.NODE_ENV === "production"
    ? "production"
    : process.env.NODE_ENV === "test"
      ? "test"
      : "development",
);
