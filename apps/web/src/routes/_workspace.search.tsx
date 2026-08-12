import { createFileRoute } from "@tanstack/react-router";

import { SearchPage } from "../features/search/search-page";

export const Route = createFileRoute("/_workspace/search")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" ? { q: search.q } : {},
  component: SearchPage,
});
