import { useEffect, useState } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import * as Either from "effect/Either";

import {
  useTemplateMutation,
  useTemplateQuery,
} from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import {
  deleteEvaluation,
  listEvaluationIds,
  loadEvaluation,
} from "../evaluation-storage";
import type { StoredEvaluation } from "../intake/evaluation-adapter";
import { ReportLibraryView, type LibraryReport } from "./report-library-view";
import { loadOwnerAccessToken } from "./report-credentials";
import { verdictLabels } from "./report-view";
import {
  createStoredReportShare,
  revokeStoredReportShare,
} from "./report-share-storage";

const shareKey = "maestro.idea-evaluation.active-shares";

const loadActiveShares = (): readonly string[] => {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(shareKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

export function ReportLibraryRoute() {
  return isConvexConfigured() ? (
    <LiveReportLibraryRoute />
  ) : (
    <BrowserReportLibraryRoute />
  );
}

function BrowserReportLibraryRoute() {
  const [reports, setReports] = useState<readonly StoredEvaluation[]>([]);
  const [activeShares, setActiveShares] = useState<readonly string[]>([]);
  const [hiddenReportIds, setHiddenReportIds] = useState<readonly string[]>([]);

  useEffect(() => {
    setReports(
      listEvaluationIds()
        .map(loadEvaluation)
        .filter((item): item is StoredEvaluation => item !== null),
    );
    setActiveShares(loadActiveShares());
  }, []);

  const saveShares = (ids: readonly string[]) => {
    setActiveShares(ids);
    window.localStorage.setItem(shareKey, JSON.stringify(ids));
  };
  const createShare = (id: string) => {
    const evaluation = reports.find(({ id: reportId }) => reportId === id);
    if (!evaluation) return;
    createStoredReportShare(window.localStorage, evaluation, `share_${id}`);
    saveShares([...activeShares.filter((reportId) => reportId !== id), id]);
  };
  const revokeShare = (id: string) => {
    revokeStoredReportShare(window.localStorage, `share_${id}`);
    saveShares(activeShares.filter((reportId) => reportId !== id));
  };
  const deleteReport = (id: string) => {
    deleteEvaluation(id);
    setHiddenReportIds((current) => [...current, id]);
  };
  const visibleReports: readonly LibraryReport[] = reports
    .map((report) => ({
      id: report.id,
      ideaSummary: report.answers.ideaSummary,
      report: report.report,
    }))
    .filter((report) => !hiddenReportIds.includes(report.id));

  return (
    <ReportLibraryView
      activeShareReportIds={activeShares}
      onCreateShare={createShare}
      onDelete={deleteReport}
      onRevokeShare={revokeShare}
      reports={visibleReports}
      shareHrefByReportId={{}}
      status="ready"
    />
  );
}

function LiveReportLibraryRoute() {
  const [reports, setReports] = useState<readonly StoredEvaluation[]>([]);
  const [activeShares, setActiveShares] = useState<readonly string[]>([]);
  const [ownerAccessToken] = useState(loadOwnerAccessToken);
  const [liveShareTokens, setLiveShareTokens] = useState<
    Readonly<Record<string, string>>
  >({});
  const [hiddenReportIds, setHiddenReportIds] = useState<readonly string[]>([]);
  const manageReport = useTemplateMutation(
    templateConfectRefs.public.capabilities.manageEvaluationReport
      .manageEvaluationReport,
  );
  const liveEnabled = isConvexConfigured() && ownerAccessToken !== null;
  const liveReports = useTemplateQuery(
    templateConfectRefs.public.capabilities.manageEvaluationReport
      .listOwnedEvaluationReports,
    liveEnabled && ownerAccessToken !== null ? { ownerAccessToken } : "skip",
    { isEmpty: (items) => items.length === 0 },
  );

  useEffect(() => {
    setReports(
      listEvaluationIds()
        .map(loadEvaluation)
        .filter((item): item is StoredEvaluation => item !== null),
    );
    setActiveShares(loadActiveShares());
  }, []);

  const saveShares = (ids: readonly string[]) => {
    setActiveShares(ids);
    window.localStorage.setItem(shareKey, JSON.stringify(ids));
  };

  const createShare = async (id: string) => {
    if (liveEnabled && ownerAccessToken !== null) {
      const result = await manageReport({
        reportId: id,
        ownerAccessToken,
        action: "share",
      });
      if (Either.isEither(result) && Either.isLeft(result)) return;
      const shared = Either.isEither(result) ? result.right : result;
      if (shared.shareToken) {
        setLiveShareTokens((current) => ({
          ...current,
          [id]: `/share/${shared.shareToken}`,
        }));
        setActiveShares((current) => [
          ...current.filter((item) => item !== id),
          id,
        ]);
      }
      return;
    }
    const evaluation = reports.find(({ id: reportId }) => reportId === id);
    if (!evaluation) return;
    createStoredReportShare(window.localStorage, evaluation, `share_${id}`);
    saveShares([...activeShares.filter((reportId) => reportId !== id), id]);
  };

  const revokeShare = async (id: string) => {
    if (liveEnabled && ownerAccessToken !== null) {
      const result = await manageReport({
        reportId: id,
        ownerAccessToken,
        action: "revoke-share",
      });
      if (Either.isEither(result) && Either.isLeft(result)) return;
      setActiveShares((current) => current.filter((item) => item !== id));
      setLiveShareTokens((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([reportId]) => reportId !== id),
        ),
      );
      return;
    }
    revokeStoredReportShare(window.localStorage, `share_${id}`);
    saveShares(activeShares.filter((reportId) => reportId !== id));
  };

  const visibleReports: readonly LibraryReport[] = (
    liveReports.status === "ready" || liveReports.status === "empty"
      ? liveReports.data
          .filter((report) => report.verdict in verdictLabels)
          .map((report) => ({
            id: report.reportId,
            report: {
              overallScore: report.overallScore,
              verdict: report.verdict as keyof typeof verdictLabels,
            },
          }))
      : reports.map((report) => ({
          id: report.id,
          ideaSummary: report.answers.ideaSummary,
          report: report.report,
        }))
  ).filter((report) => !hiddenReportIds.includes(report.id));
  const status = !liveEnabled
    ? "ready"
    : liveReports.status === "loading"
      ? "loading"
      : liveReports.status === "ready" || liveReports.status === "empty"
        ? "ready"
        : "unavailable";

  const deleteReport = async (id: string) => {
    if (liveEnabled && ownerAccessToken !== null) {
      const result = await manageReport({
        reportId: id,
        ownerAccessToken,
        action: "delete",
      });
      if (Either.isEither(result) && Either.isLeft(result)) return;
    } else {
      deleteEvaluation(id);
    }
    setHiddenReportIds((current) => [...current, id]);
  };

  return (
    <ReportLibraryView
      activeShareReportIds={activeShares}
      onCreateShare={createShare}
      onDelete={deleteReport}
      onRevokeShare={revokeShare}
      reports={visibleReports}
      shareHrefByReportId={liveShareTokens}
      status={status}
    />
  );
}
