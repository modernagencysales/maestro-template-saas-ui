import { createFileRoute } from "@tanstack/react-router";

import { AccountNotificationsPage } from "#features/settings/account/account-notifications-page";

export const Route = createFileRoute(
  "/_app/$workspace/settings/account/notifications",
)({
  head: () => ({ meta: [{ title: "Notifications" }] }),
  component: AccountNotificationsPage,
});
