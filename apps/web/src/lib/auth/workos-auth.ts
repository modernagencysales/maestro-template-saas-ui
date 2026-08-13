import {
  useAccessToken,
  useAuth,
} from "@workos/authkit-tanstack-react-start/client";
import { useCallback, useMemo } from "react";

type AccessTokenInput = {
  readonly forceRefreshToken: boolean;
  readonly getAccessToken: () => Promise<string | null | undefined>;
  readonly refresh: () => Promise<string | null | undefined>;
  readonly user: unknown;
};

export async function fetchWorkosAccessToken(
  input: AccessTokenInput,
): Promise<string | null> {
  if (!input.user) return null;
  return (
    (input.forceRefreshToken
      ? await input.refresh()
      : await input.getAccessToken()) ?? null
  );
}

export function useAuthFromAuthKit() {
  const { loading, user } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();
  const fetchAccessToken = useCallback(
    ({ forceRefreshToken }: { forceRefreshToken: boolean }) =>
      fetchWorkosAccessToken({
        forceRefreshToken,
        getAccessToken,
        refresh,
        user,
      }),
    [getAccessToken, refresh, user],
  );
  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: Boolean(user),
      fetchAccessToken,
    }),
    [fetchAccessToken, loading, user],
  );
}
