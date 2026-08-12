import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/settings/account")({
  component: AccountRoute,
});

function AccountRoute() {
  return <Outlet />;
}
