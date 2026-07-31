import { createFileRoute } from "@tanstack/react-router";

import { AppIdeaIntake } from "../features/public-funnel/intake/intake-view";

export const Route = createFileRoute("/evaluate")({ component: AppIdeaIntake });
