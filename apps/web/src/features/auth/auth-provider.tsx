import React from "react";

import { AuthProvider as BaseAuthProvider } from "@saas-ui/auth-provider";

import {
  adminClient,
  createAuthClient,
  createAuthService,
} from "@workspace/better-auth/client";

export const client = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
  plugins: [adminClient()],
});

export const authService = createAuthService(client);

export function AuthProvider(props: { children: React.ReactNode }) {
  return <BaseAuthProvider {...authService}>{props.children}</BaseAuthProvider>;
}
