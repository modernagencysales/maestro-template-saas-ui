import { useEffect, useState } from "react";

import type { PublicReportShare } from "./report-library";
import { PublicReportShareView } from "./public-report-share";
import { loadStoredReportShare } from "./report-share-storage";

export function PublicReportShareRoute({ token }: { readonly token: string }) {
  const [share, setShare] = useState<PublicReportShare | null>(null);
  useEffect(() => {
    setShare(loadStoredReportShare(window.localStorage, token));
  }, [token]);
  return <PublicReportShareView share={share} />;
}
