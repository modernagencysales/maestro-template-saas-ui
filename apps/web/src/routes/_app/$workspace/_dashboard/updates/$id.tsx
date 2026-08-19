import { createFileRoute } from "@tanstack/react-router";

import { UpdatesPage } from "#features/updates/updates-page";

export const Route = createFileRoute("/_app/$workspace/_dashboard/updates/$id")(
  {
    component: RouteComponent,
  },
);

function RouteComponent() {
  return <UpdatesPage params={Route.useParams()} />;
}
