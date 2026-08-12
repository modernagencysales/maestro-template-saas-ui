import { createFileRoute } from "@tanstack/react-router";
import { GoldenStatePage } from "../features/golden/state-page";
export const Route = createFileRoute("/_workspace/capabilities")({
  component: () => <GoldenStatePage state="ready-read" />,
});
