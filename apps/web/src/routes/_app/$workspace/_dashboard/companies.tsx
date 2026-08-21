import { createFileRoute } from "@tanstack/react-router";

import { CompaniesPage } from "#features/companies/companies-page.tsx";

export const Route = createFileRoute("/_app/$workspace/_dashboard/companies")({
  head: () => ({ meta: [{ title: "Companies" }] }),
  component: CompaniesPage,
});
