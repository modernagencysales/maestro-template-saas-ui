import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/notifications")({
  component: NotificationsRoute,
});

function NotificationsRoute() {
  return <BusinessSectionRoute section="notifications" />;
}
