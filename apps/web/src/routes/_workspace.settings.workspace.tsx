import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceSettingsPage } from "../features/settings/workspace/workspace-settings-page";

export const Route = createFileRoute("/_workspace/settings/workspace")({
  component: WorkspaceSettingsPage,
});
