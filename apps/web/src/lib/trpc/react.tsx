import { convexQuery, useConvexQuery } from "@convex-dev/react-query";
import { ConvexReactClient } from "convex/react";
import {
  useQuery,
  useMutation as useTanstackMutation,
} from "@tanstack/react-query";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import type React from "react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
export const convexClient = convexUrl
  ? new ConvexReactClient(convexUrl)
  : new Proxy({} as ConvexReactClient, {
      get() {
        throw new Error("VITE_CONVEX_URL is required for Convex access");
      },
    });

export const realRefs = {
  "auth.me": templateConfectRefs.public.auth.workspaces.me,
  "workspaces.bySlug": templateConfectRefs.public.auth.workspaces.bySlug,
  "workspaceMembers.list": templateConfectRefs.public.access.members.list,
};

type QueryResult = {
  readonly data: unknown;
  readonly isLoading?: boolean;
  readonly isPending?: boolean;
};
type MutationResult = {
  readonly mutate: (input?: unknown) => void;
  readonly mutateAsync: (input?: unknown) => Promise<unknown>;
  readonly isPending: boolean;
  readonly reset: () => void;
};
type StarterProcedure = {
  readonly useQuery: (input?: Record<string, unknown>) => QueryResult;
  readonly useSuspenseQuery: (
    input?: Record<string, unknown>,
  ) => readonly [unknown, QueryResult];
  readonly ensureData: (input?: Record<string, unknown>) => Promise<unknown>;
  readonly getData: (input?: Record<string, unknown>) => unknown;
  readonly useMutation: (options?: Record<string, unknown>) => MutationResult;
  readonly invalidate: () => Promise<void>;
};
export type CompatibilityApi = {
  readonly auth: {
    readonly me: StarterProcedure;
    readonly listAccounts: StarterProcedure;
  };
  readonly workspaces: {
    readonly bySlug: StarterProcedure;
    readonly create: StarterProcedure;
    readonly slugAvailable: StarterProcedure;
    readonly update: StarterProcedure;
  };
  readonly workspaceMembers: {
    readonly list: StarterProcedure;
    readonly invite: StarterProcedure;
    readonly removeMember: StarterProcedure;
    readonly updateRoles: StarterProcedure;
    readonly notificationSettings: StarterProcedure;
    readonly updateNotificationSettings: StarterProcedure;
    readonly invitation: StarterProcedure;
    readonly acceptInvitation: StarterProcedure;
  };
  readonly contacts: {
    readonly listByType: StarterProcedure;
    readonly byId: StarterProcedure;
    readonly activitiesById: StarterProcedure;
    readonly create: StarterProcedure;
    readonly update: StarterProcedure;
    readonly updateTags: StarterProcedure;
    readonly addComment: StarterProcedure;
    readonly removeComment: StarterProcedure;
  };
  readonly notifications: { readonly inbox: StarterProcedure };
  readonly billing: {
    readonly plans: StarterProcedure;
    readonly account: StarterProcedure;
    readonly listInvoices: StarterProcedure;
    readonly updateBillingDetails: StarterProcedure;
    readonly createBillingPortalSession: StarterProcedure;
    readonly createCheckoutSession: StarterProcedure;
    readonly setSubscriptionPlan: StarterProcedure;
  };
  readonly users: {
    readonly subscribeToNewsletter: StarterProcedure;
    readonly updateProfile: StarterProcedure;
  };
  readonly tags: {
    readonly create: StarterProcedure;
    readonly update: StarterProcedure;
    readonly delete: StarterProcedure;
  };
  readonly useUtils: () => CompatibilityApi;
};

export const neutralPaths = [
  "contacts.listByType",
  "contacts.byId",
  "contacts.activitiesById",
  "contacts.create",
  "contacts.update",
  "contacts.updateTags",
  "contacts.addComment",
  "contacts.removeComment",
  "notifications.inbox",
  "billing.plans",
  "billing.account",
  "billing.listInvoices",
  "billing.updateBillingDetails",
  "billing.createBillingPortalSession",
  "billing.createCheckoutSession",
  "billing.setSubscriptionPlan",
  "workspaceMembers.invite",
  "workspaceMembers.removeMember",
  "workspaceMembers.updateRoles",
  "workspaceMembers.notificationSettings",
  "workspaceMembers.updateNotificationSettings",
  "workspaceMembers.invitation",
  "workspaceMembers.acceptInvitation",
  "users.subscribeToNewsletter",
  "users.updateProfile",
  "auth.listAccounts",
  "workspaces.create",
  "workspaces.slugAvailable",
  "workspaces.update",
  "tags.create",
  "tags.update",
  "tags.delete",
] as const;

const neutral = (path: string): never => {
  throw new Error(`No Convex authority is registered for ${path}`);
};
export const assertRealAuthority = (path: string) => {
  if (!(path in realRefs)) neutral(path);
};

const isNeutral = (path: string) =>
  (neutralPaths as readonly string[]).includes(path);

const neutralData = (path: string) => (path === "billing.account" ? null : []);
export const neutralMutationValue = (path: string) =>
  isNeutral(path) ? null : neutral(path);

function procedure(path: string[]): StarterProcedure {
  const key = path.join(".");
  const ref = realRefs[key as keyof typeof realRefs];
  return {
    useQuery: (input) => {
      if (!ref && !isNeutral(key)) neutral(key);
      if (!ref) {
        const data = neutralData(key);
        return { data, isLoading: false, isPending: false };
      }
      return useConvexQuery(ref, input ?? {});
    },
    useSuspenseQuery: (input) => {
      if (!ref && !isNeutral(key)) neutral(key);
      if (!ref) {
        const data = neutralData(key);
        return [data, { data, isLoading: false, isPending: false }];
      }
      const result = useQuery(convexQuery(ref, input ?? {}));
      return [result.data, result];
    },
    ensureData: async (input) => {
      if (!ref && !isNeutral(key)) neutral(key);
      if (!ref) return neutralData(key);
      return convexClient.query(ref, input ?? {});
    },
    getData: () => (isNeutral(key) ? neutralData(key) : undefined),
    useMutation: () =>
      useTanstackMutation({
        mutationFn: async () => neutralMutationValue(key),
      }),
    invalidate: async () => undefined,
  };
}

export const api: CompatibilityApi = {
  auth: {
    me: procedure(["auth", "me"]),
    listAccounts: procedure(["auth", "listAccounts"]),
  },
  workspaces: {
    bySlug: procedure(["workspaces", "bySlug"]),
    create: procedure(["workspaces", "create"]),
    slugAvailable: procedure(["workspaces", "slugAvailable"]),
    update: procedure(["workspaces", "update"]),
  },
  workspaceMembers: {
    list: procedure(["workspaceMembers", "list"]),
    invite: procedure(["workspaceMembers", "invite"]),
    removeMember: procedure(["workspaceMembers", "removeMember"]),
    updateRoles: procedure(["workspaceMembers", "updateRoles"]),
    notificationSettings: procedure([
      "workspaceMembers",
      "notificationSettings",
    ]),
    updateNotificationSettings: procedure([
      "workspaceMembers",
      "updateNotificationSettings",
    ]),
    invitation: procedure(["workspaceMembers", "invitation"]),
    acceptInvitation: procedure(["workspaceMembers", "acceptInvitation"]),
  },
  contacts: {
    listByType: procedure(["contacts", "listByType"]),
    byId: procedure(["contacts", "byId"]),
    activitiesById: procedure(["contacts", "activitiesById"]),
    create: procedure(["contacts", "create"]),
    update: procedure(["contacts", "update"]),
    updateTags: procedure(["contacts", "updateTags"]),
    addComment: procedure(["contacts", "addComment"]),
    removeComment: procedure(["contacts", "removeComment"]),
  },
  notifications: { inbox: procedure(["notifications", "inbox"]) },
  billing: {
    plans: procedure(["billing", "plans"]),
    account: procedure(["billing", "account"]),
    listInvoices: procedure(["billing", "listInvoices"]),
    updateBillingDetails: procedure(["billing", "updateBillingDetails"]),
    createBillingPortalSession: procedure([
      "billing",
      "createBillingPortalSession",
    ]),
    createCheckoutSession: procedure(["billing", "createCheckoutSession"]),
    setSubscriptionPlan: procedure(["billing", "setSubscriptionPlan"]),
  },
  users: {
    subscribeToNewsletter: procedure(["users", "subscribeToNewsletter"]),
    updateProfile: procedure(["users", "updateProfile"]),
  },
  tags: {
    create: procedure(["tags", "create"]),
    update: procedure(["tags", "update"]),
    delete: procedure(["tags", "delete"]),
  },
  useUtils: () => api,
};

export const trpc = api;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  return props.children;
}

export const isTRPCClientError = () => false;
