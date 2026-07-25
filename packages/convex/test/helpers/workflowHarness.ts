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

export const conformanceApi = {
  startEagerFailure: makeFunctionReference<"mutation", Record<string, never>>(
    "workflowConformance:startEagerFailure",
  ),
  startQueuedFailure: makeFunctionReference<"mutation", Record<string, never>>(
    "workflowConformance:startQueuedFailure",
  ),
  workflow: components.workflow.workflow,
  event: components.workflow.event,
  journal: components.workflow.journal,
} as const;
