import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsLayout } from "../features/settings/common/settings-layout";
export const Route = createFileRoute("/_workspace/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <SettingsLayout>
      <Outlet />
    </SettingsLayout>
  );
}
