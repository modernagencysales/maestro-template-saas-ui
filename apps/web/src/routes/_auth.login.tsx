import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "../features/auth/login-page";

export const Route = createFileRoute("/_auth/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  }),
  component: LoginPage,
});
