import { createFileRoute } from "@tanstack/react-router";

import { ContactPage } from "../features/contacts/view/contact-page";

export const Route = createFileRoute("/_workspace/contacts/view/$id")({
  component: ContactDetailRoute,
});

function ContactDetailRoute() {
  const { id } = Route.useParams();
  return <ContactPage params={{ workspace: "acme", id }} />;
}
