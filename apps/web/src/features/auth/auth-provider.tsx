import React from "react";

import {
  AuthProvider as BaseAuthProvider,
  type AuthProviderProps,
} from "@saas-ui/auth-provider";

import { authClient } from "@workspace/better-auth/client";

import { goldenFixtures } from "#features/golden/fixtures";

export const client = authClient;

export function isGoldenEvidenceUrl(value: string) {
  const url = new URL(value);
  const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
  const authority = url.searchParams.get("goldenAuthority");
  return (
    (loopback.has(url.hostname) || url.hostname === "[::1]") &&
    (authority === "reference" || authority === "generated")
  );
}

export const authService: Pick<
  AuthProviderProps,
  "onLoadUser" | "onLogin" | "onSignup" | "onLogout"
> = {
  onLoadUser: async () =>
    typeof window !== "undefined" && isGoldenEvidenceUrl(window.location.href)
      ? goldenFixtures.currentUser
      : null,
  onLogin: async () => null,
  onSignup: async () => null,
  onLogout: async () => undefined,
};

export function AuthProvider(props: { children: React.ReactNode }) {
  return <BaseAuthProvider {...authService}>{props.children}</BaseAuthProvider>;
}
