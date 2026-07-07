import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/documents")({
  component: DocumentsRoute,
});

function DocumentsRoute() {
  return <BusinessSectionRoute section="documents" />;
}
