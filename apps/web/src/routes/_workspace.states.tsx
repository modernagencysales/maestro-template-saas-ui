import { createFileRoute } from "@tanstack/react-router";
import { useGoldenAdapter, useGoldenState } from "../features/golden/adapters";
import { GoldenStatePage } from "../features/golden/state-page";

export const Route = createFileRoute("/_workspace/states")({
  component: StatesRoute,
});

function StatesRoute() {
  return (
    <GoldenStatePage state={useGoldenState()} adapter={useGoldenAdapter()} />
  );
}
