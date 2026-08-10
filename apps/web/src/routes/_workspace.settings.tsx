import { createFileRoute } from "@tanstack/react-router";
import { AppearanceMenu } from "../saas-ui/appearance-menu";
import { SettingsLayout } from "../saas-ui/layouts/settings-layout";
import { PageStateView } from "../saas-ui/patterns";

export const Route = createFileRoute("/_workspace/settings")({
  component: WorkspaceSettingsRoute,
});

export function WorkspaceSettingsRoute() {
  return (
    <SettingsLayout navigation={<AppearanceMenu />} title="Settings">
      <PageStateView
        description="Connect an owned settings source to edit workspace preferences. Appearance remains available on this device."
        state="empty"
        title="No workspace settings source yet"
      />
    </SettingsLayout>
  );
}
