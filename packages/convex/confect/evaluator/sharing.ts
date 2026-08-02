export type PublicEvaluationReportSnapshot = {
  readonly reportId: string;
  readonly verdict: string;
  readonly overallScore: number;
  readonly roast: string;
  readonly strongestElement: string;
  readonly biggestWeakness: string;
  readonly improvedIdea: string;
};

const requiredString = (
  source: Readonly<Record<string, unknown>>,
  field: string,
): string => {
  const value = source[field];
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Report field ${field} is required for sharing.`);
  return value;
};

export const createPublicEvaluationReportSnapshot = (
  reportId: string,
  reportJson: string,
): PublicEvaluationReportSnapshot => {
  const parsed = JSON.parse(reportJson) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("Report JSON must contain an object.");
  const report = parsed as Readonly<Record<string, unknown>>;
  const overallScore = report.overallScore;
  if (typeof overallScore !== "number" || !Number.isFinite(overallScore))
    throw new Error("Report score is required for sharing.");
  return {
    reportId,
    verdict: requiredString(report, "verdict"),
    overallScore,
    roast: requiredString(report, "roast"),
    strongestElement: requiredString(report, "strongestElement"),
    biggestWeakness: requiredString(report, "biggestWeakness"),
    improvedIdea: requiredString(report, "improvedIdea"),
  };
};
