import { convexQuery, useConvexQuery } from "@convex-dev/react-query";
import { ConvexReactClient } from "convex/react";
import {
  useMutation as useTanstackMutation,
  useSuspenseQuery as useTanstackSuspenseQuery,
} from "@tanstack/react-query";
import {
  getFunctionReference,
  templateConfectRefs,
} from "@maestro-template/convex/refs";
import type React from "react";

import {
  isFixtureAuthRuntime,
  isIsolatedContractsRuntime,
} from "#lib/auth/route-auth";

export const realRefs = {
  "auth.me": getFunctionReference(
    templateConfectRefs.public.auth.workspaces.me,
  ),
  "workspaces.bySlug": getFunctionReference(
    templateConfectRefs.public.auth.workspaces.bySlug,
  ),
  "workspaceMembers.list": getFunctionReference(
    templateConfectRefs.public.access.members.list,
  ),
};

export type CurrentUser = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly image: null;
  readonly workspaces: readonly Workspace[];
};
export type Workspace = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly logo?: string | null;
  readonly tags: readonly WorkspaceTag[];
  readonly members: readonly WorkspaceMember[];
  readonly subscription: WorkspaceSubscription;
};
export type WorkspaceTag = {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
};
export type WorkspaceSubscription = {
  readonly accountId: string | null;
  readonly planId: string;
  readonly status:
    | "active"
    | "canceled"
    | "past_due"
    | "trialing"
    | "unpaid"
    | "incomplete"
    | "incomplete_expired"
    | "paused";
  readonly startedAt: Date;
  readonly trialEndsAt: Date | null;
  readonly cancelAt: Date | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEnd: Date;
};
export type WorkspaceMember = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatar: null;
  readonly roles: readonly ("viewer" | "editor" | "admin" | "owner")[];
  readonly status: "active";
};
type QueryResult<TData = unknown> = {
  readonly data: TData;
  readonly isLoading?: boolean;
  readonly isPending?: boolean;
};
type StarterError = Error & {
  readonly data?: { readonly httpStatus?: number };
};
type StarterQueryOptions = {
  readonly retry?: (failureCount: number, error: StarterError) => boolean;
};
type ConvexQueryRef = Parameters<typeof convexQuery>[0];
type MutationResult = {
  readonly mutate: (input?: unknown) => void;
  readonly mutateAsync: (input?: unknown) => Promise<unknown>;
  readonly isPending: boolean;
  readonly reset: () => void;
};
type StarterProcedure<TData = unknown> = {
  readonly useQuery: (
    input?: Record<string, unknown>,
    options?: StarterQueryOptions,
  ) => QueryResult<TData>;
  readonly useSuspenseQuery: (
    input?: Record<string, unknown>,
    options?: StarterQueryOptions,
  ) => readonly [TData, QueryResult<TData>];
  readonly ensureData: (input?: Record<string, unknown>) => Promise<TData>;
  readonly getData: (input?: Record<string, unknown>) => TData | undefined;
  readonly useMutation: (options?: Record<string, unknown>) => MutationResult;
  readonly invalidate: (input?: Record<string, unknown>) => Promise<void>;
};
export type CompatibilityApi = {
  readonly auth: {
    readonly me: StarterProcedure<CurrentUser>;
    readonly listAccounts: StarterProcedure;
  };
  readonly workspaces: {
    readonly invalidate: (input?: Record<string, unknown>) => Promise<void>;
    readonly bySlug: StarterProcedure<Workspace | null>;
    readonly create: StarterProcedure;
    readonly slugAvailable: StarterProcedure;
    readonly update: StarterProcedure;
  };
  readonly workspaceMembers: {
    readonly list: StarterProcedure<readonly WorkspaceMember[]>;
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

const neutralData = (path: string) => {
  if (path === "billing.account") return null;
  if (path === "notifications.inbox") return { notifications: [] };
  return [];
};

const runtimeUserFixture: CurrentUser = {
  id: "fixture-runtime",
  email: "fixture@template.local",
  name: "Fixture runtime",
  image: null,
  workspaces: [],
};
const contractsUserFixture: CurrentUser = {
  ...runtimeUserFixture,
  id: "contracts-runtime",
  email: "contracts@template.local",
  name: "Contracts runtime",
};
const runtimeWorkspaceFixtures = new Map<string, Workspace>();

const defaultSubscription = (): WorkspaceSubscription => ({
  accountId: null,
  planId: "free",
  status: "active",
  startedAt: new Date(0),
  trialEndsAt: null,
  cancelAt: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: new Date(0),
});

const hasWorkspaceIdentity = (
  candidate: Partial<Workspace>,
): candidate is Partial<Workspace> & Pick<Workspace, "id" | "slug" | "name"> =>
  typeof candidate.id === "string" &&
  typeof candidate.slug === "string" &&
  typeof candidate.name === "string";

const hasStarterWorkspaceRelations = (
  candidate: Partial<Workspace>,
): candidate is Workspace =>
  Array.isArray(candidate.tags) &&
  Array.isArray(candidate.members) &&
  candidate.subscription !== undefined;

const arrayOrEmpty = <T,>(value: readonly T[] | undefined): readonly T[] =>
  Array.isArray(value) ? value : [];

const normalizeWorkspace = (value: unknown): Workspace | null => {
  if (value === null) return null;
  if (typeof value !== "object") return null;
  const candidate = value as Partial<Workspace>;
  if (!hasWorkspaceIdentity(candidate)) return null;
  if (hasStarterWorkspaceRelations(candidate)) return candidate;
  return {
    id: candidate.id,
    slug: candidate.slug,
    name: candidate.name,
    logo: candidate.logo,
    tags: arrayOrEmpty(candidate.tags),
    members: arrayOrEmpty(candidate.members),
    subscription: {
      ...defaultSubscription(),
      ...(candidate.subscription ?? {}),
    },
  };
};

const adaptProcedureData = <TData,>(key: string, value: unknown): TData =>
  (key === "workspaces.bySlug" ? normalizeWorkspace(value) : value) as TData;

const workspaceFixture = (
  slug: string,
  isolatedContracts: boolean,
): Workspace => {
  const prefix = isolatedContracts ? "contracts" : "fixture";
  const fixtureKey = `${prefix}:${slug}`;
  const existing = runtimeWorkspaceFixtures.get(fixtureKey);
  if (existing) return existing;
  const workspace = {
    id: `${prefix}-${slug}`,
    slug,
    name: isolatedContracts ? "Contracts workspace" : "Fixture workspace",
    tags: [],
    members: [],
    subscription: defaultSubscription(),
  };
  runtimeWorkspaceFixtures.set(fixtureKey, workspace);
  return workspace;
};

const runtimeFixture = (
  path: string,
  input?: Record<string, unknown>,
): unknown => {
  if (!isFixtureAuthRuntime()) return undefined;
  const isolatedContracts = isIsolatedContractsRuntime();
  if (path === "auth.me") {
    return isolatedContracts ? contractsUserFixture : runtimeUserFixture;
  }
  if (path !== "workspaces.bySlug") return undefined;
  if (typeof input?.slug !== "string") return undefined;
  return workspaceFixture(input.slug, isolatedContracts);
};
export const neutralMutationValue = (path: string) =>
  isNeutral(path) ? null : neutral(path);

function procedure<TData = unknown>(
  path: string[],
  client?: Pick<ConvexReactClient, "query">,
): StarterProcedure<TData> {
  const key = path.join(".");
  const ref = realRefs[key as keyof typeof realRefs];
  const convexRef = ref as unknown as ConvexQueryRef;
  return {
    useQuery: (input, options) => {
      void options;
      const fixture = runtimeFixture(key, input);
      if (fixture !== undefined) {
        return {
          data: adaptProcedureData<TData>(key, fixture),
          isLoading: false,
          isPending: false,
        };
      }
      if (!ref && !isNeutral(key)) neutral(key);
      if (!ref) {
        const data = neutralData(key);
        return { data: data as TData, isLoading: false, isPending: false };
      }
      const result = useConvexQuery(convexRef, input ?? {}) as QueryResult;
      return {
        ...result,
        data: adaptProcedureData<TData>(key, result.data),
      };
    },
    useSuspenseQuery: (input, options) => {
      void options;
      const fixture = runtimeFixture(key, input);
      if (fixture !== undefined) {
        const result = {
          data: fixture as TData,
          isLoading: false,
          isPending: false,
        };
        return [
          adaptProcedureData<TData>(key, result.data),
          {
            ...result,
            data: adaptProcedureData<TData>(key, result.data),
          },
        ];
      }
      if (!ref && !isNeutral(key)) neutral(key);
      if (!ref) {
        const data = neutralData(key);
        return [
          data as TData,
          { data: data as TData, isLoading: false, isPending: false },
        ];
      }
      const queryOptions = convexQuery(convexRef, input ?? {}) as Parameters<
        typeof useTanstackSuspenseQuery
      >[0];
      const result = useTanstackSuspenseQuery(queryOptions);
      const data = adaptProcedureData<TData>(key, result.data);
      return [data, { ...result, data } as QueryResult<TData>];
    },
    ensureData: async (input) => {
      const fixture = runtimeFixture(key, input);
      if (fixture !== undefined) return adaptProcedureData<TData>(key, fixture);
      if (!ref && !isNeutral(key)) neutral(key);
      if (!ref) return neutralData(key) as TData;
      if (!client)
        throw new Error(`Router Convex client is required for ${key}`);
      const data = await client.query(
        convexRef as never,
        (input ?? {}) as never,
      );
      return adaptProcedureData<TData>(key, data);
    },
    getData: () =>
      (isNeutral(key) ? neutralData(key) : undefined) as TData | undefined,
    useMutation: () =>
      useTanstackMutation({
        mutationFn: async () => neutralMutationValue(key),
      }),
    invalidate: async () => undefined,
  };
}

export const createCompatibilityApi = (
  client?: Pick<ConvexReactClient, "query">,
): CompatibilityApi => {
  const api: CompatibilityApi = {
    auth: {
      me: procedure<CurrentUser>(["auth", "me"], client),
      listAccounts: procedure(["auth", "listAccounts"], client),
    },
    workspaces: {
      invalidate: async () => undefined,
      bySlug: procedure<Workspace | null>(["workspaces", "bySlug"], client),
      create: procedure(["workspaces", "create"], client),
      slugAvailable: procedure(["workspaces", "slugAvailable"], client),
      update: procedure(["workspaces", "update"], client),
    },
    workspaceMembers: {
      list: procedure<readonly WorkspaceMember[]>(
        ["workspaceMembers", "list"],
        client,
      ),
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
  return api;
};

export const api = createCompatibilityApi();

export const trpc = api;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  return props.children;
}

export const isTRPCClientError = () => false;
