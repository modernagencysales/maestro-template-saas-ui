import * as React from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { InboxLayout } from "../features/contacts/inbox/inbox-layout";

export const Route = createFileRoute("/_workspace/inbox")({
  component: InboxRoute,
});

function InboxRoute() {
  const { id } = Route.useParams();
  const params = React.useMemo(
    () => ({ workspace: "acme", ...(id ? { id } : {}) }),
    [id],
  );
  return (
    <InboxLayout params={params}>
      <Outlet />
    </InboxLayout>
  );
}
