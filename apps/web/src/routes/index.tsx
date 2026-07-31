import { createFileRoute } from "@tanstack/react-router";

import { AppIdeaLanding } from "../features/public-funnel/landing";

export const Route = createFileRoute("/")({
  component: AppIdeaLanding,
});
