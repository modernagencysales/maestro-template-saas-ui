import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/build-pack/$packId")({
  component: BuildPackLayoutRoute,
});

function BuildPackLayoutRoute() {
  return <Outlet />;
}
