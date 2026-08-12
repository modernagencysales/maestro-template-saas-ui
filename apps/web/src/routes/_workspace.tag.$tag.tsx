import { createFileRoute } from "@tanstack/react-router";

import { ContactsListPage } from "../features/contacts/list/list-page";

export const Route = createFileRoute("/_workspace/tag/$tag")({
  component: TagRoute,
});

function TagRoute() {
  const { tag } = Route.useParams();
  return <ContactsListPage params={{ workspace: "acme", tag }} />;
}
