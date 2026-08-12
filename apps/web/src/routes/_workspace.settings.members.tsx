import { createFileRoute } from "@tanstack/react-router";

import { MembersSettingsPage } from "../features/settings/members/members-page";

export const Route = createFileRoute("/_workspace/settings/members")({
  component: MembersSettingsPage,
});
