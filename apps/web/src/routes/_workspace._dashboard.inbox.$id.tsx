import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { InboxViewPage } from "../features/contacts/inbox/inbox-view-page";

export const Route = createFileRoute("/_workspace/_dashboard/inbox/$id")({
  validateSearch: z.object({ contactId: z.string() }),
  component: InboxDetailRoute,
});

function InboxDetailRoute() {
  const { contactId } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <InboxViewPage
      params={{ workspace: "acme", id: contactId }}
      onBack={() => navigate({ to: "/inbox" })}
    />
  );
}
