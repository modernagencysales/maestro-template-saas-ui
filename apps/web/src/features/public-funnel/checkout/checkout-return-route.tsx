import { useEffect, useState } from "react";

import { PublicFunnelShell } from "../public-shell";
import { entitlementStatusFor } from "./commerce-storage";
import { CheckoutView } from "./checkout-view";

export function CheckoutReturnRoute() {
  const [reportId, setReportId] = useState("");
  const [entitled, setEntitled] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const returnedReportId = search.get("report_id") ?? "";
    setReportId(returnedReportId);
    const refresh = () =>
      setEntitled(entitlementStatusFor(returnedReportId) === "active");
    refresh();
    const interval = window.setInterval(refresh, 1_500);
    return () => window.clearInterval(interval);
  }, []);

  if (entitled) {
    return (
      <PublicFunnelShell>
        <main className="idea-checkout-status" id="main-content">
          <p className="idea-section-label">Payment confirmed</p>
          <h1>Your Complete Build Pack is ready to start.</h1>
          <p>
            Your purchase also created an equal Maestro credit. Generation can
            resume without another payment if a provider stage needs retrying.
          </p>
          <a
            className="idea-primary-action"
            href={`/build-pack/${reportId}/generating`}
          >
            Generate my Build Pack
          </a>
        </main>
      </PublicFunnelShell>
    );
  }

  return (
    <CheckoutView
      priceCents={buildPackPriceCents}
      reportId={reportId}
      state={{ _tag: "payment-pending" }}
    />
  );
}

const buildPackPriceCents = 2_900;
