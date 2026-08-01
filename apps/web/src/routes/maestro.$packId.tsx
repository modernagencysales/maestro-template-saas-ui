import { createFileRoute } from "@tanstack/react-router";

import { MaestroOfferRoute } from "../features/public-funnel/maestro/maestro-offer-route";

export const Route = createFileRoute("/maestro/$packId")({
  component: OfferRoute,
});

function OfferRoute() {
  const { packId } = Route.useParams();
  return <MaestroOfferRoute packId={packId} />;
}
