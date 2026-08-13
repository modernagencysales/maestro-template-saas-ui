import { redirect } from "@tanstack/react-router";
import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";

import { safeReturnPath } from "./return-path";

export { safeReturnPath };

export function requireAuthenticatedRoute(input: {
  readonly auth?: { readonly user: unknown; readonly accessToken?: string };
  readonly location: { readonly pathname: string; readonly searchStr: string };
}) {
  const auth =
    input.auth ??
    (() => {
      try {
        return getAuthKitContext().auth() as {
          readonly user: unknown;
          readonly accessToken?: string;
        };
      } catch {
        return { user: null };
      }
    })();
  if (!auth.user) {
    redirect({
      to: "/login",
      search: {
        redirectTo: safeReturnPath(
          `${input.location.pathname}${input.location.searchStr}`,
        ),
      },
      throw: true,
    });
  }
  const { accessToken: _accessToken, ...safeAuth } = auth;
  void _accessToken;
  return { auth: safeAuth };
}
