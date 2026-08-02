import { createFileRoute } from "@tanstack/react-router";

import { BuildPackGeneratingRoute } from "../features/public-funnel/build-pack/build-pack-generating-route";

export const Route = createFileRoute("/build-pack/$packId/generating")({
  component: GeneratingRoute,
});

function GeneratingRoute() {
  const { packId } = Route.useParams();
  return <BuildPackGeneratingRoute reportId={packId} />;
}
