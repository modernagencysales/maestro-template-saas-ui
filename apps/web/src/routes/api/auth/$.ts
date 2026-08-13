import { createFileRoute } from "@tanstack/react-router";
import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";
import { handleWorkosLogout, isLogoutRequest } from "#lib/auth/workos-logout";
import { isRecoverableAuthError } from "#lib/auth/workos-auth-loader";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const pathname = new URL(request.url).pathname;
        if (isLogoutRequest(request)) return handleWorkosLogout(request);
        if (pathname.endsWith("/session")) {
          try {
            const auth = getAuthKitContext().auth();
            if (!auth.user) return Response.json({ data: null });
            const { accessToken: _accessToken, ...safeAuth } = auth;
            void _accessToken;
            return Response.json({
              data: { session: safeAuth, user: safeAuth.user },
            });
          } catch (error) {
            if (!isRecoverableAuthError(error)) throw error;
            return Response.json({ data: null });
          }
        }
        return new Response("Not found", { status: 404 });
      },
      POST: async ({ request }) => handleWorkosLogout(request),
    },
  },
});
