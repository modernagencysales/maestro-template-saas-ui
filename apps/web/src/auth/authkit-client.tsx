import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import {
  AuthKitProvider,
  useAccessToken,
  useAuth,
  type AuthKitProviderProps,
} from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";

import type { AuthSnapshot } from "./authkit-server";

type AuthKitInitialAuth = NonNullable<AuthKitProviderProps["initialAuth"]>;

type WorkosConvexAuthState = {
  readonly user: { readonly id?: string } | null;
  readonly loading: boolean;
  readonly token: {
    readonly loading: boolean;
    readonly accessToken: string | undefined;
    readonly getAccessToken: () => Promise<string | undefined>;
  };
};

export const authSnapshotToInitialAuth = (
  snapshot: AuthSnapshot,
): AuthKitInitialAuth => {
  if (snapshot.status === "signedOut") return { user: null };

  return {
    user: {
      id: snapshot.subject,
      email: snapshot.email,
    },
    sessionId: snapshot.subject,
    organizationId: snapshot.organizationId,
  } as AuthKitInitialAuth;
};

export const createWorkosConvexAuthHook = (
  useWorkosState: () => WorkosConvexAuthState,
) =>
  function useWorkosConvexAuth() {
    const state = useWorkosState();

    return {
      isLoading: state.loading || state.token.loading,
      isAuthenticated: Boolean(state.user && !state.token.loading),
      fetchAccessToken: async () =>
        (await state.token.getAccessToken()) ?? null,
    };
  };

const useWorkosConvexAuth = createWorkosConvexAuthHook(() => {
  const auth = useAuth();
  const token = useAccessToken();

  return {
    user: auth.user,
    loading: auth.loading,
    token,
  };
});

export function AuthKitProviderWithConvexProviderWithAuth({
  children,
  client,
  initialAuthSnapshot,
}: {
  readonly children: ReactNode;
  readonly client: ConvexReactClient;
  readonly initialAuthSnapshot: AuthSnapshot;
}) {
  return (
    <AuthKitProvider
      initialAuth={authSnapshotToInitialAuth(initialAuthSnapshot)}
    >
      <ConvexProviderWithAuth client={client} useAuth={useWorkosConvexAuth}>
        {children}
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}
