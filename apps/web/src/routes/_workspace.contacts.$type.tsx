import { createFileRoute } from "@tanstack/react-router";

import { ContactsListPage } from "../features/contacts/list/list-page";

export const Route = createFileRoute("/_workspace/contacts/$type")({
  component: ContactsTypeRoute,
});

function ContactsTypeRoute() {
  const { type } = Route.useParams();
  return <ContactsListPage params={{ workspace: "acme", type: type as "leads" | "customers" }} />;
}
