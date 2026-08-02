import { createFileRoute } from "@tanstack/react-router";

import { FakeHostedCheckoutRoute } from "../features/public-funnel/checkout/fake-hosted-checkout-route";

export const Route = createFileRoute("/checkout/fake-hosted/$sessionId")({
  component: FakeCheckoutRoute,
});

function FakeCheckoutRoute() {
  const { sessionId } = Route.useParams();
  return <FakeHostedCheckoutRoute sessionId={sessionId} />;
}
