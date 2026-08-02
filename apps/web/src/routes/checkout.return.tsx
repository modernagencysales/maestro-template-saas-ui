import { createFileRoute } from "@tanstack/react-router";

import { CheckoutReturnRoute } from "../features/public-funnel/checkout/checkout-return-route";

export const Route = createFileRoute("/checkout/return")({
  component: CheckoutReturnRoute,
});
