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
import type {
  ContactDTO,
  NotificationDTO,
  TagDTO,
  WorkspaceDTO,
  WorkspaceMemberDTO,
  WorkspaceMemberSettingsDTO,
  WorkspaceSubscriptionDTO,
} from "@workspace/api/types";
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
export type Workspace = WorkspaceDTO;
export type WorkspaceTag = TagDTO;
export type WorkspaceSubscription = WorkspaceSubscriptionDTO;
export type WorkspaceMember = WorkspaceMemberDTO;
type QueryResult<TData = unknown> = {
  readonly data: TData;
  readonly isLoading?: boolean;
  readonly isPending?: boolean;
  readonly error?: StarterError | null;
};
type StarterError = Error & {
  readonly data?: { readonly httpStatus?: number };
};
type StarterQueryOptions = {
  readonly retry?: (failureCount: number, error: StarterError) => boolean;
};
type ConvexQueryRef = Parameters<typeof convexQuery>[0];
type MutationResult<TData, TInput> = {
  readonly data: TData | undefined;
  readonly variables: TInput | undefined;
  readonly mutate: (input: TInput) => void;
  readonly mutateAsync: (input: TInput) => Promise<TData>;
  readonly isPending: boolean;
  readonly reset: () => void;
};
type StarterMutationOptions<TData> = {
  readonly onSuccess?: (data: TData) => void;
  readonly onError?: (error: StarterError) => void;
  readonly onSettled?: (
    data: TData | undefined,
    error: StarterError | null,
  ) => void;
};
type StarterProcedure<
  TQueryData = unknown,
  TMutationData = null,
  TMutationInput = Record<string, unknown>,
> = {
  readonly useQuery: (
    input?: Record<string, unknown>,
    options?: StarterQueryOptions,
  ) => QueryResult<TQueryData>;
  readonly useSuspenseQuery: (
    input?: Record<string, unknown>,
    options?: StarterQueryOptions,
  ) => readonly [TQueryData, QueryResult<TQueryData>];
  readonly ensureData: (input?: Record<string, unknown>) => Promise<TQueryData>;
  readonly getData: (input?: Record<string, unknown>) => TQueryData | undefined;
  readonly setData: (input: Record<string, unknown>, data: TQueryData) => void;
  readonly useMutation: (
    options?: StarterMutationOptions<TMutationData>,
  ) => MutationResult<TMutationData, TMutationInput>;
  readonly invalidate: (input?: Record<string, unknown>) => Promise<void>;
};

export type StarterActivity = {
  readonly id: string;
  readonly actorId: string | null;
  readonly actorType: string;
  readonly metadata: Record<string, unknown> | null;
  readonly type: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};
type AuthAccount = {
  readonly providerId: string;
  readonly updatedAt: Date | null;
};
type Invoice = {
  readonly number: string;
  readonly date: Date;
  readonly status: string;
  readonly total: number;
  readonly currency: string;
  readonly url: string | null;
};
type BillingPlan = {
  readonly id: string;
  readonly name: string;
};
type NotificationSettingsInput = {
  readonly workspaceId: string;
  readonly channels?: WorkspaceMemberSettingsDTO["channels"];
  readonly topics?: WorkspaceMemberSettingsDTO["topics"];
  readonly newsletters?: WorkspaceMemberSettingsDTO["newsletters"];
};
export type CompatibilityApi = {
  readonly auth: {
    readonly me: StarterProcedure<CurrentUser>;
    readonly listAccounts: StarterProcedure<readonly AuthAccount[]>;
  };
  readonly workspaces: {
    readonly invalidate: (input?: Record<string, unknown>) => Promise<void>;
    readonly bySlug: StarterProcedure<Workspace | null>;
    readonly create: StarterProcedure<unknown, Workspace>;
    readonly slugAvailable: StarterProcedure<unknown, { available: boolean }>;
    readonly update: StarterProcedure<unknown, Workspace>;
  };
  readonly workspaceMembers: {
    readonly list: StarterProcedure<readonly WorkspaceMember[]>;
    readonly invite: StarterProcedure;
    readonly removeMember: StarterProcedure;
    readonly updateRoles: StarterProcedure;
    readonly notificationSettings: StarterProcedure<WorkspaceMemberSettingsDTO>;
    readonly updateNotificationSettings: StarterProcedure<
      unknown,
      null,
      NotificationSettingsInput
    >;
    readonly invitation: StarterProcedure<{
      workspace: Workspace;
      invitedBy?: string;
    } | null>;
    readonly acceptInvitation: StarterProcedure;
  };
  readonly contacts: {
    readonly listByType: StarterProcedure<{ contacts: ContactDTO[] }>;
    readonly byId: StarterProcedure<ContactDTO>;
    readonly activitiesById: StarterProcedure<{
      activities: StarterActivity[];
    }>;
    readonly create: StarterProcedure<unknown, ContactDTO>;
    readonly update: StarterProcedure<unknown, ContactDTO>;
    readonly updateTags: StarterProcedure;
    readonly addComment: StarterProcedure;
    readonly removeComment: StarterProcedure;
  };
  readonly notifications: {
    readonly inbox: StarterProcedure<{ notifications: NotificationDTO[] }>;
  };
  readonly billing: {
    readonly plans: StarterProcedure<readonly BillingPlan[]>;
    readonly account: StarterProcedure<{ email: string } | null>;
    readonly listInvoices: StarterProcedure<readonly Invoice[]>;
    readonly updateBillingDetails: StarterProcedure;
    readonly createBillingPortalSession: StarterProcedure<
      unknown,
      { url: string }
    >;
    readonly createCheckoutSession: StarterProcedure<unknown, { url: string }>;
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
  if (path === "contacts.listByType") return { contacts: [] };
  if (path === "contacts.activitiesById") return { activities: [] };
  if (path === "notifications.inbox") return { notifications: [] };
  if (path === "workspaceMembers.notificationSettings") {
    return { channels: {}, topics: {}, newsletters: {} };
  }
  if (path === "workspaceMembers.invitation") return null;
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

const arrayOrEmpty = <T,>(value: readonly T[] | undefined): T[] =>
  Array.isArray(value) ? [...value] : [];

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
const inputString = (
  input: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string => (typeof input?.[key] === "string" ? input[key] : fallback);

const billingSessionPaths: readonly string[] = [
  "billing.createBillingPortalSession",
  "billing.createCheckoutSession",
];
const workspaceMutationPaths: readonly string[] = [
  "workspaces.create",
  "workspaces.update",
];
const contactMutationPaths: readonly string[] = [
  "contacts.create",
  "contacts.update",
];

const neutralWorkspace = (input?: Record<string, unknown>): Workspace => {
  const slug = inputString(input, "slug", "workspace");
  return {
    ...workspaceFixture(slug, false),
    id: inputString(input, "id", `fixture-${slug}`),
    name: inputString(input, "name", "Fixture workspace"),
  };
};

const neutralContact = (input?: Record<string, unknown>): ContactDTO => ({
  id: inputString(input, "id", "fixture-contact"),
  workspaceId: inputString(input, "workspaceId", "fixture-workspace"),
  name: inputString(input, "name", "Fixture contact"),
  email: inputString(input, "email", "contact@template.local"),
  avatar: null,
  status:
    input?.status === "active" || input?.status === "inactive"
      ? input.status
      : "new",
  type: input?.type === "customer" ? "customer" : "lead",
  tags: Array.isArray(input?.tags) ? input.tags : [],
  sortOrder: null,
  createdAt: new Date(0),
});

export const neutralMutationValue = (
  path: string,
  input?: Record<string, unknown>,
): unknown => {
  if (!isNeutral(path)) return neutral(path);
  if (path === "workspaces.slugAvailable") return { available: true };
  if (billingSessionPaths.includes(path)) {
    return { url: "#" };
  }
  if (workspaceMutationPaths.includes(path)) return neutralWorkspace(input);
  if (contactMutationPaths.includes(path)) return neutralContact(input);
  return null;
};

function procedure<
  TQueryData = unknown,
  TMutationData = null,
  TMutationInput = Record<string, unknown>,
>(
  path: string[],
  client?: Pick<ConvexReactClient, "query">,
): StarterProcedure<TQueryData, TMutationData, TMutationInput> {
  const key = path.join(".");
  const ref = realRefs[key as keyof typeof realRefs];
  const convexRef = ref as unknown as ConvexQueryRef;
  return {
    useQuery: (input, options) => {
      void options;
      const fixture = runtimeFixture(key, input);
      if (fixture !== undefined) {
        return {
          data: adaptProcedureData<TQueryData>(key, fixture),
          isLoading: false,
          isPending: false,
        };
      }
      if (!ref && !isNeutral(key)) neutral(key);
      if (!ref) {
        const data = neutralData(key);
        return {
          data: data as TQueryData,
          isLoading: false,
          isPending: false,
        };
      }
      const result = useConvexQuery(convexRef, input ?? {}) as QueryResult;
      return {
        ...result,
        data: adaptProcedureData<TQueryData>(key, result.data),
      };
    },
    useSuspenseQuery: (input, options) => {
      void options;
      const fixture = runtimeFixture(key, input);
      if (fixture !== undefined) {
        const result = {
          data: fixture as TQueryData,
          isLoading: false,
          isPending: false,
        };
        return [
          adaptProcedureData<TQueryData>(key, result.data),
          {
            ...result,
            data: adaptProcedureData<TQueryData>(key, result.data),
          },
        ];
      }
      if (!ref && !isNeutral(key)) neutral(key);
      if (!ref) {
        const data = neutralData(key);
        return [
          data as TQueryData,
          {
            data: data as TQueryData,
            isLoading: false,
            isPending: false,
          },
        ];
      }
      const queryOptions = convexQuery(convexRef, input ?? {}) as Parameters<
        typeof useTanstackSuspenseQuery
      >[0];
      const result = useTanstackSuspenseQuery(queryOptions);
      const data = adaptProcedureData<TQueryData>(key, result.data);
      return [data, { ...result, data } as QueryResult<TQueryData>];
    },
    ensureData: async (input) => {
      const fixture = runtimeFixture(key, input);
      if (fixture !== undefined) {
        return adaptProcedureData<TQueryData>(key, fixture);
      }
      if (!ref && !isNeutral(key)) neutral(key);
      if (!ref) return neutralData(key) as TQueryData;
      if (!client)
        throw new Error(`Router Convex client is required for ${key}`);
      const data = await client.query(
        convexRef as never,
        (input ?? {}) as never,
      );
      return adaptProcedureData<TQueryData>(key, data);
    },
    getData: () =>
      (isNeutral(key) ? neutralData(key) : undefined) as TQueryData | undefined,
    setData: () => undefined,
    useMutation: (options) =>
      useTanstackMutation<TMutationData, StarterError, TMutationInput>({
        mutationFn: async (input) =>
          neutralMutationValue(
            key,
            input as Record<string, unknown>,
          ) as TMutationData,
        ...(options?.onSuccess ? { onSuccess: options.onSuccess } : {}),
        ...(options?.onError ? { onError: options.onError } : {}),
        ...(options?.onSettled ? { onSettled: options.onSettled } : {}),
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
      listAccounts: procedure<readonly AuthAccount[]>(
        ["auth", "listAccounts"],
        client,
      ),
    },
    workspaces: {
      invalidate: async () => undefined,
      bySlug: procedure<Workspace | null>(["workspaces", "bySlug"], client),
      create: procedure<unknown, Workspace>(["workspaces", "create"], client),
      slugAvailable: procedure<unknown, { available: boolean }>(
        ["workspaces", "slugAvailable"],
        client,
      ),
      update: procedure<unknown, Workspace>(["workspaces", "update"], client),
    },
    workspaceMembers: {
      list: procedure<readonly WorkspaceMember[]>(
        ["workspaceMembers", "list"],
        client,
      ),
      invite: procedure(["workspaceMembers", "invite"]),
      removeMember: procedure(["workspaceMembers", "removeMember"]),
      updateRoles: procedure(["workspaceMembers", "updateRoles"]),
      notificationSettings: procedure<WorkspaceMemberSettingsDTO>(
        ["workspaceMembers", "notificationSettings"],
        client,
      ),
      updateNotificationSettings: procedure<
        unknown,
        null,
        NotificationSettingsInput
      >(["workspaceMembers", "updateNotificationSettings"]),
      invitation: procedure<{
        workspace: Workspace;
        invitedBy?: string;
      } | null>(["workspaceMembers", "invitation"]),
      acceptInvitation: procedure(["workspaceMembers", "acceptInvitation"]),
    },
    contacts: {
      listByType: procedure<{ contacts: ContactDTO[] }>([
        "contacts",
        "listByType",
      ]),
      byId: procedure<ContactDTO>(["contacts", "byId"]),
      activitiesById: procedure<{ activities: StarterActivity[] }>([
        "contacts",
        "activitiesById",
      ]),
      create: procedure<unknown, ContactDTO>(["contacts", "create"]),
      update: procedure<unknown, ContactDTO>(["contacts", "update"]),
      updateTags: procedure(["contacts", "updateTags"]),
      addComment: procedure(["contacts", "addComment"]),
      removeComment: procedure(["contacts", "removeComment"]),
    },
    notifications: {
      inbox: procedure<{ notifications: NotificationDTO[] }>([
        "notifications",
        "inbox",
      ]),
    },
    billing: {
      plans: procedure<readonly BillingPlan[]>(["billing", "plans"]),
      account: procedure<{ email: string } | null>(["billing", "account"]),
      listInvoices: procedure<readonly Invoice[]>(["billing", "listInvoices"]),
      updateBillingDetails: procedure(["billing", "updateBillingDetails"]),
      createBillingPortalSession: procedure<unknown, { url: string }>([
        "billing",
        "createBillingPortalSession",
      ]),
      createCheckoutSession: procedure<unknown, { url: string }>([
        "billing",
        "createCheckoutSession",
      ]),
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

export const isTRPCClientError = (
  error: unknown,
): error is StarterError & {
  readonly data: { readonly httpStatus?: number };
} =>
  error instanceof Error &&
  "data" in error &&
  typeof error.data === "object" &&
  error.data !== null;
