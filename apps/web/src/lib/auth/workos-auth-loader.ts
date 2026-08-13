type RawAuth = {
  readonly accessToken?: string;
  readonly user: unknown;
  readonly [key: string]: unknown;
};
import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";

export function stripAccessToken(auth: RawAuth) {
  const { accessToken: _accessToken, ...safe } = auth;
  void _accessToken;
  return safe;
}

export function loadInitialAuth(
  getAuth: () => RawAuth = () => getAuthKitContext().auth() as RawAuth,
) {
  try {
    return stripAccessToken(getAuth());
  } catch {
    return { user: null };
  }
}
