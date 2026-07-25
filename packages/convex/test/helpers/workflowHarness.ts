import workflowTest from "@convex-dev/workflow/test";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { components } from "../../convex/_generated/api";

const generatedModules = import.meta.glob("../../convex/**/*.ts");
const modules = {
  ...generatedModules,
  "../../convex/workflowConformance.ts": () =>
    import("../fixtures/workflows/componentFunctions"),
};

export const createWorkflowHarness = () => {
  const t = convexTest(undefined, modules);
  workflowTest.register(t, "workflow");
  return t;
};

const mutationRef = <Args extends Record<string, unknown>, Result>(
  name: string,
) =>
  makeFunctionReference<"mutation", Args, Result>(
    `workflowConformance:${name}`,
  );

const queryRef = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"query", Args, Result>(`workflowConformance:${name}`);

export const conformanceApi = {
  startEagerFailure: makeFunctionReference<"mutation", Record<string, never>>(
    "workflowConformance:startEagerFailure",
  ),
  startQueuedFailure: makeFunctionReference<"mutation", Record<string, never>>(
    "workflowConformance:startQueuedFailure",
  ),
  startEventBeforeWait: mutationRef<Record<string, never>, string>(
    "startEventBeforeWait",
  ),
  sendInvalidEventPayload: mutationRef<{ workflowId: string }, null>(
    "sendInvalidEventPayload",
  ),
  startParallel: mutationRef<Record<string, never>, string>("startParallel"),
  startParent: mutationRef<Record<string, never>, string>("startParent"),
  startRestartWorkflow: mutationRef<Record<string, never>, string>(
    "startRestartWorkflow",
  ),
  startFailingOnComplete: mutationRef<Record<string, never>, string>(
    "startFailingOnComplete",
  ),
  cancelWorkflow: mutationRef<{ workflowId: string }, null>("cancelWorkflow"),
  restartFromDuplicate: mutationRef<{ workflowId: string }, null>(
    "restartFromDuplicate",
  ),
  cleanupWorkflow: mutationRef<{ workflowId: string }, boolean>(
    "cleanupWorkflow",
  ),
  workflowStatus: queryRef<{ workflowId: string }, unknown>("workflowStatus"),
  listWorkflows: queryRef<
    { cursor: string | null; numItems: number },
    { page: unknown[]; continueCursor: string; isDone: boolean }
  >("listWorkflows"),
  listWorkflowSteps: queryRef<
    { workflowId: string; cursor: string | null; numItems: number },
    {
      page: Array<{
        name: string;
        workflowId?: string;
        workId?: string;
      }>;
      continueCursor: string;
      isDone: boolean;
    }
  >("listWorkflowSteps"),
  workflow: components.workflow.workflow,
  event: components.workflow.event,
  journal: components.workflow.journal,
} as const;
