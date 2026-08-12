import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "../features/contacts/view/contact-page";

export const Route = createFileRoute("/_workspace/contacts/$contactId")({
  component: ContactRoute,
});

function ContactRoute() {
  const { contactId } = Route.useParams();
  return <ContactPage params={{ workspace: "acme", id: contactId }} />;
}
