import type { StoredEvaluation } from "../intake/evaluation-adapter";

export type ReportLibrary = {
  readonly reports: readonly StoredEvaluation[];
};

export type PublicReportShare = {
  readonly token: string;
  readonly status: "active" | "revoked";
  readonly snapshot: {
    readonly reportId: string;
    readonly verdict: StoredEvaluation["report"]["verdict"];
    readonly overallScore: number;
    readonly roast: string;
    readonly strongestElement: string;
    readonly biggestWeakness: string;
    readonly improvedIdea: string;
  };
};

export const createReportLibrary = (): ReportLibrary => ({ reports: [] });

export const addReportToLibrary = (
  library: ReportLibrary,
  evaluation: StoredEvaluation,
): ReportLibrary => ({
  reports: [
    evaluation,
    ...library.reports.filter(({ id }) => id !== evaluation.id),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
});

export const shareReportSnapshot = (
  evaluation: StoredEvaluation,
  token: string,
): PublicReportShare => ({
  token,
  status: "active",
  snapshot: {
    reportId: evaluation.id,
    verdict: evaluation.report.verdict,
    overallScore: evaluation.report.overallScore,
    roast: evaluation.report.roast,
    strongestElement: evaluation.report.strongestElement,
    biggestWeakness: evaluation.report.biggestWeakness,
    improvedIdea: evaluation.report.improvedIdea,
  },
});

export const revokeReportShare = (
  share: PublicReportShare,
): PublicReportShare => ({ ...share, status: "revoked" });
