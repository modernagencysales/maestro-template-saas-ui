import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/settings/account/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/account/profile" });
  },
});
