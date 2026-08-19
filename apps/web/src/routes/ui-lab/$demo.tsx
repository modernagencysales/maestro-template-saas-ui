import { createFileRoute } from "@tanstack/react-router";

import { UiLabPage } from "#features/ui-lab/ui-lab-page";

export const Route = createFileRoute("/ui-lab/$demo")({
  head: ({ params }) => ({
    meta: [{ title: `${params.demo} · Saas UI Pro UI Lab` }],
  }),
  component: UiLabRoute,
});

function UiLabRoute() {
  const { demo } = Route.useParams();
  return <UiLabPage demo={demo} />;
}
