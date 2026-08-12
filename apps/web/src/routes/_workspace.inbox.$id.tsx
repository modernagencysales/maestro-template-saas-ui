import { createFileRoute } from "@tanstack/react-router";

import { InboxLayout } from "../features/contacts/inbox/inbox-layout";

export const Route = createFileRoute("/_workspace/inbox/$id")({
  component: InboxDetailRoute,
});

function InboxDetailRoute() {
  const { id } = Route.useParams();
  return (
    <InboxLayout params={{ workspace: "acme", id }}>
      {null}
    </InboxLayout>
  );
}
