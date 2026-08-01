import { useState } from "react";

import { beginFakeCheckout } from "./commerce-storage";
import { CheckoutView, type CheckoutViewState } from "./checkout-view";

export const buildPackPriceCents = 2_900;

export function BuildPackCheckoutRoute({
  reportId,
}: {
  readonly reportId: string;
}) {
  const [state, setState] = useState<CheckoutViewState>({ _tag: "ready" });

  const startCheckout = () => {
    setState({ _tag: "redirecting" });
    try {
      const session = beginFakeCheckout(reportId, buildPackPriceCents);
      // Fake-provider delivery is deliberately separate from the return route.
      window.location.assign(session.hostedCheckoutUrl);
    } catch {
      setState({
        _tag: "error",
        message:
          "Unable to open checkout. Check your connection and try again.",
      });
    }
  };

  return (
    <CheckoutView
      onCheckout={startCheckout}
      priceCents={buildPackPriceCents}
      reportId={reportId}
      state={state}
    />
  );
}
