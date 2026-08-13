import React from "react";
import {
  AuthProvider as BaseAuthProvider,
  type AuthProviderProps,
} from "@saas-ui/auth-provider";

type StarterUser = {
  readonly id: string;
  readonly name?: string;
  readonly email?: string;
  readonly image?: string | null;
};

export const client = {
  getSession: async () => {
    const response = await fetch("/api/auth/session");
    if (!response.ok) return { data: null };
    return (await response.json()) as {
      data: { session: { id: string }; user: StarterUser } | null;
    };
  },
};

const redirectToAuth = (path: string) => {
  window.location.assign(
    `/api/auth/${path}?returnPathname=${encodeURIComponent(window.location.pathname)}`,
  );
  return null;
};

export const authService: Pick<
  AuthProviderProps,
  "onLoadUser" | "onLogin" | "onSignup" | "onLogout"
> = {
  onLoadUser: async () => (await client.getSession()).data?.user ?? null,
  onLogin: async () => redirectToAuth("sign-in"),
  onSignup: async () => redirectToAuth("sign-up"),
  onLogout: async () => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/api/auth/logout";
    document.body.append(form);
    form.submit();
  },
};

export function AuthProvider(props: { children: React.ReactNode }) {
  return <BaseAuthProvider {...authService}>{props.children}</BaseAuthProvider>;
}
