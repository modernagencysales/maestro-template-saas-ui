import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { AppLoader } from "@workspace/ui/app-loader";

import { AuthLayout } from "#features/auth/auth-layout";

export const Route = createFileRoute("/_auth")({
  validateSearch: z.object({
    redirectTo: z.string().optional(),
  }),
  beforeLoad: ({ context }) => {
    if (context.auth?.user) {
      throw redirect({
        to: "/",
      });
    }
  },
  pendingComponent: AppLoader,
  component: () => (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  ),
});
