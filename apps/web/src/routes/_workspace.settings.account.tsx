import { createFileRoute } from "@tanstack/react-router";

import { AccountProfilePage } from "../features/settings/account/account-profile-page";

export const Route = createFileRoute("/_workspace/settings/account")({
  component: AccountProfilePage,
});
