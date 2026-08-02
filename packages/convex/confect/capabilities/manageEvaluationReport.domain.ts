export type ReportAction =
  "revise" | "share" | "revoke-share" | "claim" | "delete";

export type ManageEvaluationReportInput = {
  readonly reportId: string;
  readonly accessToken?: string;
  readonly ownerAccessToken?: string;
  readonly action: ReportAction;
  readonly revisionJson?: string;
};

export const normalizeManageEvaluationReportInput = (
  input: ManageEvaluationReportInput,
): ManageEvaluationReportInput => ({
  reportId: input.reportId.trim(),
  ...(input.accessToken === undefined
    ? {}
    : { accessToken: input.accessToken.trim() }),
  ...(input.ownerAccessToken === undefined
    ? {}
    : { ownerAccessToken: input.ownerAccessToken.trim() }),
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
  if (!input.accessToken?.trim() && !input.ownerAccessToken?.trim())
    errors.push("An anonymous or verified-owner access token is required.");
  if (input.action === "revise" && !input.revisionJson?.trim()) {
    errors.push("revisionJson is required to revise a report.");
  }
  return errors;
};
