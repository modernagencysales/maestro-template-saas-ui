import { deliverFakeVerifiedPaymentWebhook } from "./commerce-storage";
import { FakeHostedCheckoutView } from "./fake-hosted-checkout";

export function FakeHostedCheckoutRoute({
  sessionId,
}: {
  readonly sessionId: string;
}) {
  const search =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const reportId = search.get("report_id") ?? "";
  const amountCents = Number(search.get("amount_cents") ?? "0");
  const requestedReturnUrl = search.get("return_url") ?? "/checkout/return";
  const returnUrl = /^\/(?![\\/])/.test(requestedReturnUrl)
    ? requestedReturnUrl
    : "/checkout/return";

  const pay = () => {
    deliverFakeVerifiedPaymentWebhook({
      checkoutSessionId: sessionId,
      reportId,
      amountCents,
      returnUrl,
      hostedCheckoutUrl: window.location.pathname + window.location.search,
    });
    window.location.assign(returnUrl);
  };

  return (
    <FakeHostedCheckoutView
      amountCents={amountCents}
      onPay={pay}
      reportId={reportId}
      sessionId={sessionId}
    />
  );
}
