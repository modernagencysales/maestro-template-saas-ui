import { createFileRoute } from "@tanstack/react-router";
import { InboxLayout } from "../features/contacts/inbox/inbox-layout";

export const Route = createFileRoute("/_workspace/inbox")({
  component: InboxRoute,
});

function InboxRoute() {
  return (
    <InboxLayout params={{ workspace: "acme" }}>
      {null}
    </InboxLayout>
  );
}
