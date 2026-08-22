import {
  selectStalePKCEVerifierCookieNames,
  type AuthService,
} from "@workos/authkit-session";

import {
  appendHeaderBag,
  appendResponseCookies,
  parseCookieHeader,
} from "./workos-cookie-session-storage";

export async function appendStaleVerifierDeletes(
  auth: AuthService<Request, Response>,
  request: Request,
  keepCookieName: string,
  headers: Headers,
  redirectUri: string,
) {
  const stale = selectStalePKCEVerifierCookieNames(
    Object.keys(parseCookieHeader(request.headers.get("cookie") ?? "")),
    { keep: keepCookieName },
  );
  await Promise.all(
    stale.map(async (cookieName) => {
      try {
        const result = await auth.clearPendingVerifierByName(undefined, {
          cookieName,
          redirectUri,
        });
        appendResponseCookies(headers, result.response);
        appendHeaderBag(headers, result.headers);
      } catch {
        // Stale verifier cleanup is best effort; the current flow must proceed.
      }
    }),
  );
}
