import {
  getAccessTokenAction,
  getAuth,
} from "@workos/authkit-tanstack-react-start";
import type {
  NoUserInfo,
  UserInfo,
} from "@workos/authkit-tanstack-react-start";

type RawAuth = UserInfo | NoUserInfo;
type ConvexAuthClient = {
  readonly setAuth: (fetchToken: () => Promise<string | null>) => void;
};
const isHttpErrorStatus = (status: unknown) =>
  typeof status === "number" && status >= 400;

export function isRecoverableAuthError(error: unknown): boolean {
  if (error === "HTTPError") return true;
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    response?: { status?: unknown };
    cause?: unknown;
  };
  return (
    candidate.name === "HTTPError" ||
    candidate.message === "HTTPError" ||
    isHttpErrorStatus(candidate.status) ||
    isHttpErrorStatus(candidate.response?.status) ||
    isRecoverableAuthError(candidate.cause)
  );
}

export function stripAccessToken(auth: RawAuth) {
  if (!auth.user) return auth;
  const { accessToken: _accessToken, ...safe } = auth;
  void _accessToken;
  return safe;
}

export async function loadInitialAuthForConvex(
  client: ConvexAuthClient,
  readAuth: () => Promise<RawAuth> = getAuth,
  readAccessToken: () => Promise<
    string | null | undefined
  > = getAccessTokenAction,
) {
  try {
    const auth = await readAuth();
    if (auth.user) {
      client.setAuth(async () => (await readAccessToken()) ?? null);
    }
    return stripAccessToken(auth);
  } catch (error) {
    if (!isRecoverableAuthError(error)) throw error;
    return { user: null };
  }
}
