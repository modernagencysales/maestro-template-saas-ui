import { createFileRoute } from "@tanstack/react-router";
import { createAuthService, getConfig } from "@workos/authkit-session";
import { safeReturnPath } from "#lib/auth/return-path";
import {
  appendHeaderBag,
  appendResponseCookies,
  StartCookieSessionStorage,
} from "#lib/auth/workos-cookie-session-storage";
import { appendStaleVerifierDeletes } from "#lib/auth/workos-auth-entry";

export const Route = createFileRoute("/api/auth/sign-up")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = createAuthService<Request, Response>({
          sessionStorageFactory: (config) =>
            new StartCookieSessionStorage(config),
        });
        const result = await auth.createSignUp(undefined, {
          redirectUri: getConfig("redirectUri"),
          returnPathname: safeReturnPath(
            new URL(request.url).searchParams.get("returnPathname"),
          ),
        });
        const headers = new Headers({ Location: result.url });
        appendResponseCookies(headers, result.response);
        appendHeaderBag(headers, result.headers);
        await appendStaleVerifierDeletes(
          auth,
          request,
          result.cookieName,
          headers,
          getConfig("redirectUri"),
        );
        return new Response(null, { status: 307, headers });
      },
    },
  },
});
