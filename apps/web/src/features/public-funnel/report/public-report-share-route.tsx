import { useEffect, useState } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";

import { useTemplateQuery } from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import { PublicFunnelShell } from "../public-shell";
import type { PublicReportShare } from "./report-library";
import { PublicReportShareView } from "./public-report-share";
import { loadStoredReportShare } from "./report-share-storage";

export function PublicReportShareRoute({ token }: { readonly token: string }) {
  return isConvexConfigured() ? (
    <LivePublicReportShareRoute token={token} />
  ) : (
    <BrowserPublicReportShareRoute token={token} />
  );
}

function BrowserPublicReportShareRoute({ token }: { readonly token: string }) {
  const [share, setShare] = useState<PublicReportShare | null>(null);
  useEffect(() => {
    setShare(loadStoredReportShare(window.localStorage, token));
  }, [token]);
  return <PublicReportShareView share={share} />;
}

function LivePublicReportShareRoute({ token }: { readonly token: string }) {
  const liveShare = useTemplateQuery(
    templateConfectRefs.public.capabilities.manageEvaluationReport
      .getSharedEvaluationReport,
    { shareToken: token },
  );
  if (liveShare.status === "loading") {
    return (
      <PublicFunnelShell>
        <main className="idea-loading" id="main-content" aria-busy="true">
          <p>Loading shared report…</p>
        </main>
      </PublicFunnelShell>
    );
  }
  if (liveShare.status === "ready" && liveShare.data !== null) {
    try {
      const snapshot = JSON.parse(
        liveShare.data.publicSnapshotJson,
      ) as PublicReportShare["snapshot"];
      return (
        <PublicReportShareView share={{ token, status: "active", snapshot }} />
      );
    } catch {
      return <PublicReportShareView share={null} />;
    }
  }
  return <PublicReportShareView share={null} />;
}
