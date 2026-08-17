import { redirect } from "@tanstack/react-router";
import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";

import { safeReturnPath } from "./return-path";
import { isRecoverableAuthError } from "./workos-auth-loader";

export { safeReturnPath };

type RouteAuth = { readonly user: unknown; readonly accessToken?: string };

export const isIsolatedContractsRuntime = () =>
  import.meta.env.DEV && import.meta.env.VITE_MAESTRO_CONTRACT_MODE === "1";

export function loadRouteAuth(
  getAuth: () => RouteAuth = () => getAuthKitContext().auth() as RouteAuth,
): RouteAuth {
  try {
    return getAuth();
  } catch (error) {
    if (!isRecoverableAuthError(error)) throw error;
    return { user: null };
  }
}

export function requireAuthenticatedRoute(input: {
  readonly auth?: { readonly user: unknown; readonly accessToken?: string };
  readonly location: { readonly pathname: string; readonly searchStr: string };
}) {
  if (isIsolatedContractsRuntime()) {
    return { auth: { user: { id: "contracts-runtime" } } };
  }
  const auth = input.auth ?? loadRouteAuth();
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
