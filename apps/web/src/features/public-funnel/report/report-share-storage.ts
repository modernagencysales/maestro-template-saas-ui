import type { StoredEvaluation } from "../intake/evaluation-adapter";
import {
  revokeReportShare,
  shareReportSnapshot,
  type PublicReportShare,
} from "./report-library";

export type ReportShareStorage = Pick<Storage, "getItem" | "setItem">;

const shareKey = (token: string): string =>
  `maestro.idea-evaluation.share.${token}`;

export const createStoredReportShare = (
  storage: ReportShareStorage,
  evaluation: StoredEvaluation,
  token: string,
): PublicReportShare => {
  const share = shareReportSnapshot(evaluation, token);
  storage.setItem(shareKey(token), JSON.stringify(share));
  return share;
};

const readShare = (
  storage: ReportShareStorage,
  token: string,
): PublicReportShare | null => {
  try {
    const value = storage.getItem(shareKey(token));
    return value ? (JSON.parse(value) as PublicReportShare) : null;
  } catch {
    return null;
  }
};

export const loadStoredReportShare = (
  storage: ReportShareStorage,
  token: string,
): PublicReportShare | null => {
  const share = readShare(storage, token);
  return share?.status === "active" ? share : null;
};

export const revokeStoredReportShare = (
  storage: ReportShareStorage,
  token: string,
): void => {
  const share = readShare(storage, token);
  if (share) {
    storage.setItem(shareKey(token), JSON.stringify(revokeReportShare(share)));
  }
};
