import { createFileRoute } from "@tanstack/react-router";
import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (new URL(request.url).pathname.endsWith("/session")) {
          try {
            const { accessToken: _accessToken, ...auth } =
              getAuthKitContext().auth() as Record<string, unknown>;
            void _accessToken;
            return Response.json({
              data: auth.user ? { session: auth, user: auth.user } : null,
            });
          } catch {
            return Response.json({ data: null });
          }
        }
        return new Response("Not found", { status: 404 });
      },
      POST: async () => new Response(null, { status: 204 }),
    },
  },
});
