import { createFileRoute } from "@tanstack/react-router";

import { BuildPackCheckoutRoute } from "../features/public-funnel/checkout/checkout-route";

export const Route = createFileRoute("/checkout/$reportId")({
  component: CheckoutRoute,
});

function CheckoutRoute() {
  const { reportId } = Route.useParams();
  return <BuildPackCheckoutRoute reportId={reportId} />;
}
