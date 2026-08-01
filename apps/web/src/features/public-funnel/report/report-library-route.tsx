import { useEffect, useState } from "react";

import { listEvaluationIds, loadEvaluation } from "../evaluation-storage";
import type { StoredEvaluation } from "../intake/evaluation-adapter";
import { ReportLibraryView } from "./report-library-view";

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
  const [reports, setReports] = useState<readonly StoredEvaluation[]>([]);
  const [activeShares, setActiveShares] = useState<readonly string[]>([]);

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

  return (
    <ReportLibraryView
      activeShareReportIds={activeShares}
      onCreateShare={(id) => saveShares([...activeShares, id])}
      onRevokeShare={(id) =>
        saveShares(activeShares.filter((reportId) => reportId !== id))
      }
      reports={reports}
    />
  );
}
