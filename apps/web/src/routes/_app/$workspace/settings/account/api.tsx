import { createFileRoute } from "@tanstack/react-router";

import { AccountApiPage } from "#features/settings/account/account-api-page";

export const Route = createFileRoute("/_app/$workspace/settings/account/api")({
  head: () => ({ meta: [{ title: "API access" }] }),
  component: AccountApiPage,
});
