import { useEffect, useRef, useState } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";

import {
  useTemplateMutation,
  useTemplateQuery,
} from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import { PublicFunnelShell } from "../public-shell";
import { loadOwnerAccessToken } from "../report/report-credentials";
import { entitlementStatusFor } from "./commerce-storage";
import { CheckoutView } from "./checkout-view";

export function CheckoutReturnRoute() {
  return isConvexConfigured() ? (
    <ConfiguredCheckoutReturnRoute />
  ) : (
    <LocalCheckoutReturnRoute />
  );
}

type PurchaseStatus =
  | "missing"
  | "created"
  | "checkout-open"
  | "payment-pending"
  | "paid"
  | "failed"
  | "refunded"
  | "disputed";

export type CheckoutReturnPresentation =
  | { readonly _tag: "entitled"; readonly reportId: string }
  | { readonly _tag: "pending"; readonly reportId: string }
  | { readonly _tag: "recovery"; readonly reportId: string }
  | {
      readonly _tag: "unavailable";
      readonly reportId: string;
      readonly reason: "failed" | "revoked";
    };

export function presentCheckoutReturn({
  reportId,
  purchaseStatus,
  entitlementStatus,
  waitedMs = 0,
}: {
  readonly reportId: string;
  readonly purchaseStatus: PurchaseStatus;
  readonly entitlementStatus: "missing" | "active" | "revoked";
  readonly waitedMs?: number;
}): CheckoutReturnPresentation {
  if (entitlementStatus === "active") {
    return { _tag: "entitled", reportId };
  }
  if (
    entitlementStatus === "revoked" ||
    purchaseStatus === "refunded" ||
    purchaseStatus === "disputed"
  ) {
    return { _tag: "unavailable", reportId, reason: "revoked" };
  }
  if (purchaseStatus === "failed") {
    return { _tag: "unavailable", reportId, reason: "failed" };
  }
  if (waitedMs >= PAYMENT_CONFIRMATION_WAIT_MS) {
    return { _tag: "recovery", reportId };
  }
  return { _tag: "pending", reportId };
}

function readReturnParameters() {
  const search = new URLSearchParams(window.location.search);
  return {
    reportId: search.get("report_id") ?? "",
    checkoutSessionId: search.get("session_id") ?? "",
  };
}

function ConfiguredCheckoutReturnRoute() {
  const [parameters] = useState(readReturnParameters);
  const [ownerAccessToken] = useState(loadOwnerAccessToken);
  const markReturned = useTemplateMutation(
    templateConfectRefs.public.commerce.checkout.markReturned,
  );
  const marked = useRef(false);
  const [waitedMs, setWaitedMs] = useState(0);
  const status = useTemplateQuery(
    templateConfectRefs.public.commerce.checkout.status,
    parameters.reportId && ownerAccessToken
      ? { reportId: parameters.reportId, ownerAccessToken }
      : "skip",
  );

  useEffect(() => {
    if (marked.current || !parameters.checkoutSessionId) return;
    marked.current = true;
    void markReturned({ checkoutSessionId: parameters.checkoutSessionId });
  }, [markReturned, parameters.checkoutSessionId]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setWaitedMs(PAYMENT_CONFIRMATION_WAIT_MS),
      PAYMENT_CONFIRMATION_WAIT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, []);

  if (
    !parameters.reportId ||
    !parameters.checkoutSessionId ||
    !ownerAccessToken
  ) {
    return <CheckoutReturnUnavailable reason="missing-access" />;
  }
  if (status.status === "ready") {
    return (
      <CheckoutReturnStatusView
        state={presentCheckoutReturn({ ...status.data, waitedMs })}
      />
    );
  }
  if (
    status.status === "typed_failure" ||
    status.status === "parse_failure" ||
    status.status === "transport_failure" ||
    status.status === "defect"
  ) {
    return <CheckoutReturnUnavailable reason="status-error" />;
  }
  return (
    <CheckoutView
      priceCents={buildPackPriceCents}
      reportId={parameters.reportId}
      state={{
        _tag:
          waitedMs >= PAYMENT_CONFIRMATION_WAIT_MS
            ? "payment-delayed"
            : "payment-pending",
      }}
      onRefresh={() => window.location.reload()}
    />
  );
}

function CheckoutReturnStatusView({
  state,
}: {
  readonly state: CheckoutReturnPresentation;
}) {
  if (state._tag === "entitled") {
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
            href={`/build-pack/${state.reportId}/generating`}
          >
            Generate my Build Pack
          </a>
        </main>
      </PublicFunnelShell>
    );
  }
  if (state._tag === "unavailable") {
    return <CheckoutReturnUnavailable reason={state.reason} />;
  }
  if (state._tag === "recovery") {
    return (
      <CheckoutView
        priceCents={buildPackPriceCents}
        reportId={state.reportId}
        state={{ _tag: "payment-delayed" }}
        onRefresh={() => window.location.reload()}
      />
    );
  }
  return (
    <CheckoutView
      priceCents={buildPackPriceCents}
      reportId={state.reportId}
      state={{ _tag: "payment-pending" }}
    />
  );
}

function CheckoutReturnUnavailable({
  reason,
}: {
  readonly reason: "failed" | "revoked" | "missing-access" | "status-error";
}) {
  const revoked = reason === "revoked";
  return (
    <PublicFunnelShell>
      <main className="idea-information" id="main-content" role="alert">
        <p className="idea-section-label">Payment access unavailable</p>
        <h1>
          {revoked
            ? "Build Pack access was revoked."
            : "Payment could not be confirmed."}
        </h1>
        <p>
          {revoked
            ? "This payment was refunded or disputed, so Build Pack access is no longer active."
            : "Return to your saved report and try checkout again, or contact support if you were charged."}
        </p>
        <a href="/support">Contact support</a>
      </main>
    </PublicFunnelShell>
  );
}

function LocalCheckoutReturnRoute() {
  const [reportId, setReportId] = useState("");
  const [entitled, setEntitled] = useState(false);
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const returnedReportId = search.get("report_id") ?? "";
    setReportId(returnedReportId);
    const refresh = () =>
      setEntitled(entitlementStatusFor(returnedReportId) === "active");
    refresh();
    const interval = window.setInterval(refresh, 1_500);
    const timeout = window.setTimeout(
      () => setDelayed(true),
      PAYMENT_CONFIRMATION_WAIT_MS,
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
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
      state={{ _tag: delayed ? "payment-delayed" : "payment-pending" }}
      onRefresh={() => window.location.reload()}
    />
  );
}

const buildPackPriceCents = 2_900;
export const PAYMENT_CONFIRMATION_WAIT_MS = 60_000;
