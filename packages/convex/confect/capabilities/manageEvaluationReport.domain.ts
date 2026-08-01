export type ReportAction =
  "revise" | "share" | "revoke-share" | "claim" | "delete";

export type ManageEvaluationReportInput = {
  readonly reportId: string;
  readonly accessToken: string;
  readonly action: ReportAction;
  readonly revisionJson?: string;
};

export const normalizeManageEvaluationReportInput = (
  input: ManageEvaluationReportInput,
): ManageEvaluationReportInput => ({
  reportId: input.reportId.trim(),
  accessToken: input.accessToken.trim(),
  action: input.action,
  ...(input.revisionJson === undefined
    ? {}
    : { revisionJson: input.revisionJson.trim() }),
});

export const validateManageEvaluationReportInput = (
  input: ManageEvaluationReportInput,
): readonly string[] => {
  const errors: string[] = [];
  if (!input.reportId.trim()) errors.push("reportId must not be blank.");
  if (!input.accessToken.trim()) errors.push("accessToken must not be blank.");
  if (input.action === "revise" && !input.revisionJson?.trim()) {
    errors.push("revisionJson is required to revise a report.");
  }
  return errors;
};
