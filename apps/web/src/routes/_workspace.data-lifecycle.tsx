import { createFileRoute } from "@tanstack/react-router";
import { GoldenStatePage } from "../features/golden/state-page";
export const Route = createFileRoute("/_workspace/data-lifecycle")({
  component: () => <GoldenStatePage state="ready-edit" />,
});
