import { createFileRoute } from "@tanstack/react-router";

import { TagsSettingsPage } from "../features/settings/tags/tags-settings-page";

export const Route = createFileRoute("/_workspace/settings/tags")({
  component: TagsSettingsPage,
});
