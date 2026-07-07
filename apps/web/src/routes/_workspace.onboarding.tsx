import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/onboarding")({
  component: OnboardingRoute,
});

function OnboardingRoute() {
  return <BusinessSectionRoute section="onboarding" />;
}
