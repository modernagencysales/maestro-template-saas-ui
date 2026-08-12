import { createFileRoute } from "@tanstack/react-router";
import { GoldenStatePage } from "../features/golden/state-page";
export const Route = createFileRoute("/_workspace/_dashboard/health")({
  component: () => <GoldenStatePage state="ready-read" />,
});
