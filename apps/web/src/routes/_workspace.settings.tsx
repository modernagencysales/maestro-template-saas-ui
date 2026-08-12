import { createFileRoute } from "@tanstack/react-router";
import { SettingsLayout } from "../features/settings/common/settings-layout";
export const Route = createFileRoute("/_workspace/settings")({
  component: SettingsLayout,
});
