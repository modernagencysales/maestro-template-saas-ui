type WorkflowDraft = {
  readonly retryDeclared: boolean;
  readonly retryMapped: boolean;
  readonly executionMode: string;
  readonly stepNames: readonly string[];
  readonly payload: unknown;
  readonly principalContext: unknown;
};

export const findWorkflowConformanceIssues = (
  draft: WorkflowDraft,
): readonly string[] => {
  const findings: string[] = [];
  if (draft.retryDeclared && !draft.retryMapped) {
    findings.push("WF-ACTION-RETRY-MAPPING");
  }
  if (draft.executionMode === "serial-only") {
    findings.push("WF-PARALLEL-DISPATCH");
  }
  if (draft.stepNames.some((name) => !/\.v[1-9][0-9]*$/.test(name))) {
    findings.push("WF-STABLE-STEP-NAME");
  }
  if (!isConvexValue(draft.payload)) findings.push("WF-CONVEX-VALUE");
  if (draft.principalContext === null) {
    findings.push("WF-PRINCIPAL-CONTEXT");
  }
  return findings;
};

const isConvexValue = (value: unknown): boolean => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isConvexValue);
  if (typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every(isConvexValue);
};
