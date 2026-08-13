import { createFileRoute } from "@tanstack/react-router";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";
import { guardedCallback } from "#lib/auth/workos-callback";

export const Route = createFileRoute("/api/auth/callback")({
  server: { handlers: { GET: guardedCallback(handleCallbackRoute()) } },
});
