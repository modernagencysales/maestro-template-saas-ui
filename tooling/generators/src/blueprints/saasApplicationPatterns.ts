export type SaasApplicationPatternId =
  "records-example" | "workflow-automation";

export type SaasApplicationPatternSelection = Readonly<{
  patterns?: readonly SaasApplicationPatternId[] | undefined;
}>;

export const SAAS_APPLICATION_PATTERN_GROUPS = {
  "records-example": {
    label: "Complete records example",
  },
  "workflow-automation": {
    label: "Workflow automation runtime",
  },
} as const satisfies Readonly<
  Record<SaasApplicationPatternId, Readonly<{ label: string }>>
>;

export const selectsSaasApplicationPattern = (
  selection: SaasApplicationPatternSelection,
  pattern: SaasApplicationPatternId,
): boolean => selection.patterns?.includes(pattern) ?? false;

const WORKFLOW_AUTOMATION_PREFIXES = [
  "tooling/workflow/",
  "packages/convex/confect/workflows/",
  "packages/convex/confect/workflowContracts/",
  "packages/convex/confect/workflowRunners/",
  "packages/convex/confect/_generated/registeredFunctions/workflow",
  "packages/convex/confect/_generated/tables/workflow",
  "packages/convex/confect/tables/workflow",
  "packages/convex/confect/demo/showcase.",
  "packages/convex/convex/components/workflow",
  "packages/convex/convex/workflows/",
  "packages/convex/convex/workflowContracts/",
  "packages/convex/convex/workflowRunners/",
  "packages/convex/confect/capabilities/_versions/publicationEcho/",
  "packages/convex/confect/_generated/registeredFunctions/capabilities/_versions/publicationEcho/",
  "packages/convex/convex/capabilities/_versions/publicationEcho/",
  "packages/convex/test/fixtures/workflow",
  "packages/convex/test/workflow",
] as const;

export const isWorkflowAutomationPath = (path: string): boolean =>
  path !== "packages/convex/confect/workflows/_generated/workflowRegistry.ts" &&
  (WORKFLOW_AUTOMATION_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    [
      "packages/convex/test/helpers/workflowHarness.ts",
      "packages/convex/test/publicationFixture.workflow.test.ts",
      "packages/convex/test/trust-receipt.test.ts",
    ].includes(path));

export const isRecordsOnlyWorkflowProvenancePath = (path: string): boolean =>
  path.startsWith("docs/template/generated/provenance/add-workflow/") ||
  [
    "docs/template/generated/provenance/add-table/workflowArtifacts.json",
    "docs/template/generated/provenance/add-table/workflowEffectReservations.json",
  ].includes(path);
