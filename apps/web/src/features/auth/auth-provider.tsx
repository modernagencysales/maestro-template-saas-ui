import React from "react";

import {
  AuthProvider as BaseAuthProvider,
  type AuthProviderProps,
} from "@saas-ui/auth-provider";

import { demoUser } from "#lib/backend-fixtures";

const session = { id: "parity-session", userId: demoUser.id };
const storageKey = "maestro-starter-demo-session";

const isSignedIn = () =>
  typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "1";

export const client = {
  getSession: async () => ({
    data: isSignedIn() ? { session, user: demoUser } : null,
  }),
};

export const authService: Pick<
  AuthProviderProps,
  "onLoadUser" | "onLogin" | "onSignup" | "onLogout"
> = {
  onLoadUser: async () => (isSignedIn() ? demoUser : null),
  onLogin: async () => {
    window.localStorage.setItem(storageKey, "1");
    return demoUser;
  },
  onSignup: async () => {
    window.localStorage.setItem(storageKey, "1");
    return demoUser;
  },
  onLogout: async () => window.localStorage.removeItem(storageKey),
};

export function AuthProvider(props: { children: React.ReactNode }) {
  return <BaseAuthProvider {...authService}>{props.children}</BaseAuthProvider>;
}
