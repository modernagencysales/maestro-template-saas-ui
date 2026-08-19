import { Outlet, createFileRoute } from "@tanstack/react-router";

import { UpdatesLayout } from "#features/updates/updates-layout";

export const Route = createFileRoute("/_app/$workspace/_dashboard/updates")({
  head: () => ({ meta: [{ title: "Updates" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  return (
    <UpdatesLayout params={params}>
      <Outlet />
    </UpdatesLayout>
  );
}
