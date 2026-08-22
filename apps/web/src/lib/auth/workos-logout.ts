import { createAuthService, getConfig } from "@workos/authkit-session";
import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";

import {
  appendHeaderBag,
  appendResponseCookies,
  StartCookieSessionStorage,
} from "./workos-cookie-session-storage";

export function isLogoutRequest(request: Request): boolean {
  const url = new URL(request.url);
  return (
    request.method === "POST" &&
    url.pathname.endsWith("/logout") &&
    request.headers.get("Origin") === url.origin
  );
}

export async function handleWorkosLogout(request: Request): Promise<Response> {
  const auth = createAuthService<Request, Response>({
    sessionStorageFactory: (config) => new StartCookieSessionStorage(config),
  });
  const raw = getAuthKitContext().auth() as {
    readonly user?: unknown;
    readonly sessionId?: string;
  };
  const headers = new Headers();
  if (raw.user && raw.sessionId) {
    const result = await auth.signOut(raw.sessionId, {
      returnTo: new URL(request.url).origin,
    });
    headers.set("Location", result.logoutUrl);
    appendResponseCookies(headers, result.response);
    appendHeaderBag(headers, result.headers);
  } else {
    const result = await auth.clearSession(new Response());
    appendResponseCookies(headers, result.response);
    appendHeaderBag(headers, result.headers);
    headers.set("Location", getConfig("redirectUri"));
  }
  return new Response(null, { status: 307, headers });
}
