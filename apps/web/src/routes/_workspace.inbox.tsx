import * as React from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { InboxLayout } from "../features/contacts/inbox/inbox-layout";

export const Route = createFileRoute("/_workspace/inbox")({
  component: InboxRoute,
});

function InboxRoute() {
  const params = React.useMemo(() => ({ workspace: "acme" }), []);
  return (
    <InboxLayout params={params}>
      <Outlet />
    </InboxLayout>
  );
}
