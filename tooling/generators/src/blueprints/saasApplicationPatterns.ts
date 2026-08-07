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
