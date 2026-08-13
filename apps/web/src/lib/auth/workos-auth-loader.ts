type RawAuth = {
  readonly accessToken?: string;
  readonly user: unknown;
  readonly [key: string]: unknown;
};
import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";

function isRecoverableAuthError(error: unknown): boolean {
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
    (typeof candidate.status === "number" && candidate.status >= 400) ||
    (typeof candidate.response?.status === "number" &&
      candidate.response.status >= 400) ||
    isRecoverableAuthError(candidate.cause)
  );
}

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
  } catch (error) {
    if (!isRecoverableAuthError(error)) throw error;
    return { user: null };
  }
}
