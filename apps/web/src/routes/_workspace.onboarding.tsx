import { createFileRoute } from "@tanstack/react-router";
import { GettingStartedPage } from "../features/getting-started/getting-started-page";
export const Route = createFileRoute("/_workspace/onboarding")({
  component: GettingStartedPage,
});
