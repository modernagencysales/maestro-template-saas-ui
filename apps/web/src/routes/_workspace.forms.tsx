import { createFileRoute } from "@tanstack/react-router";
import { GoldenFormPage } from "../features/golden/form-page";

export const Route = createFileRoute("/_workspace/forms")({
  component: GoldenFormPage,
});
