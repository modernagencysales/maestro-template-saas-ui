import { createFileRoute } from "@tanstack/react-router";
import { ContactsListPage } from "../features/contacts/list/list-page";

export const Route = createFileRoute("/_workspace/contacts")({
  component: ContactsRoute,
});

function ContactsRoute() {
  return <ContactsListPage params={{ workspace: "acme" }} />;
}
