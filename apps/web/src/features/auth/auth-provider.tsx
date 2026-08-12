import React from "react";

import {
  AuthProvider as BaseAuthProvider,
  type AuthProviderProps,
} from "@saas-ui/auth-provider";

import { authClient } from "@workspace/better-auth/client";

import { goldenFixtures } from "#features/golden/fixtures";

export const client = authClient;
export const authService: Pick<
  AuthProviderProps,
  "onLoadUser" | "onLogin" | "onSignup" | "onLogout"
> = {
  onLoadUser: async () => goldenFixtures.currentUser,
  onLogin: async () => null,
  onSignup: async () => null,
  onLogout: async () => undefined,
};

export function AuthProvider(props: { children: React.ReactNode }) {
  return <BaseAuthProvider {...authService}>{props.children}</BaseAuthProvider>;
}
