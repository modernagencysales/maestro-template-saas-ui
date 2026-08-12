import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { InboxViewPage } from "../features/contacts/inbox/inbox-view-page";

export const Route = createFileRoute("/_workspace/inbox/$id")({
  validateSearch: z.object({ contactId: z.string() }),
  component: InboxDetailRoute,
});

function InboxDetailRoute() {
  const { contactId } = Route.useSearch();
  return <InboxViewPage params={{ workspace: "acme", id: contactId }} />;
}
