import { createFileRoute } from "@tanstack/react-router";
import { InboxLayout } from "../features/contacts/inbox/inbox-layout";

export const Route = createFileRoute("/_workspace/inbox")({
  component: InboxLayout,
});
