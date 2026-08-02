const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const scheduledSubworkflowFinding = (
  node: unknown,
): string | undefined => {
  if (!isRecord(node) || node.kind !== "subworkflow" || !("schedule" in node)) {
    return undefined;
  }
  const nodeId = typeof node.id === "string" ? node.id : "unknown";
  return `subworkflow node ${nodeId} cannot use runAt or runAfter on pinned Workflow 0.4.4 because runWorkflow drops scheduled-child options; use a named sleep followed by an unscheduled child as a deliberately non-equivalent alternative, or a tested compatible upgrade`;
};
