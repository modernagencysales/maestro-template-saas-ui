import { createFileRoute } from "@tanstack/react-router";
import { workosAuthCatchAllRouteOptions } from "#lib/auth/workos-auth-catch-all";

export const Route = createFileRoute("/api/auth/$")(
  workosAuthCatchAllRouteOptions,
);
