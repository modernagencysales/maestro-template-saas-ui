import { createFileRoute } from "@tanstack/react-router";

import { ResetPasswordPage } from "../features/auth/reset-password-page";

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
});
