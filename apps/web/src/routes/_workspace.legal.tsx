import { createFileRoute } from "@tanstack/react-router";
import { GoldenStatePage } from "../features/golden/state-page";
export const Route = createFileRoute("/_workspace/legal")({
  component: () => <GoldenStatePage state="ready-read" />,
});
