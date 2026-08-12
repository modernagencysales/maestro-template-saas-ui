import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "../features/settings/billing/billing-page";
export const Route = createFileRoute("/_workspace/billing")({
  component: BillingPage,
});
