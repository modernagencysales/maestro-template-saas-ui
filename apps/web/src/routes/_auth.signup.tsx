import { createFileRoute } from "@tanstack/react-router";

import { SignupPage } from "../features/auth/signup-page";

export const Route = createFileRoute("/_auth/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  }),
  component: SignupPage,
});
