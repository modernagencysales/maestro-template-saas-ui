import { createFileRoute } from "@tanstack/react-router";

import { InboxViewPage } from "../features/contacts/inbox/inbox-view-page";

export const Route = createFileRoute("/_workspace/inbox/$id")({
  component: InboxDetailRoute,
});

function InboxDetailRoute() {
  const { id } = Route.useParams();
  return <InboxViewPage params={{ workspace: "acme", id }} />;
}
