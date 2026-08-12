import { createFileRoute } from "@tanstack/react-router";
import { useGoldenState } from "../features/golden/adapters";
import { GoldenFormPage } from "../features/golden/form-page";

export const Route = createFileRoute("/_workspace/_dashboard/forms")({
  component: FormsRoute,
});

function FormsRoute() {
  return <GoldenFormPage state={useGoldenState()} />;
}
