import { createFileRoute } from "@tanstack/react-router";

import { BuildPackReadyRoute } from "../features/public-funnel/build-pack/build-pack-ready-route";

export const Route = createFileRoute("/build-pack/$packId/")({
  component: ReadyRoute,
});

function ReadyRoute() {
  const { packId } = Route.useParams();
  return <BuildPackReadyRoute packId={packId} />;
}
