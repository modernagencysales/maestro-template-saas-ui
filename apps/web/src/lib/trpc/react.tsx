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
  "search.all",
  "workspaceMembers.invite",
  "workspaceMembers.removeMember",
  "workspaceMembers.updateRoles",
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

function procedure(path: string[]): any {
  const key = path.join(".");
  return new Proxy(() => undefined, {
    get: (_target, property) => {
      if (property === "useQuery") {
        const ref = realRefs[key as keyof typeof realRefs];
        return (input?: Record<string, unknown>) => {
          if (!ref && !isNeutral(key)) neutral(key);
          if (!ref) {
            const data = neutralData(key);
            return { data, isLoading: false, isPending: false };
          }
          return useConvexQuery(ref, input ?? {});
        };
      }
      if (property === "useSuspenseQuery") {
        const ref = realRefs[key as keyof typeof realRefs];
        return (input?: Record<string, unknown>) => {
          if (!ref && !isNeutral(key)) neutral(key);
          if (!ref) {
            const data = neutralData(key);
            return [data, { data, isLoading: false, isPending: false }];
          }
          const result = useQuery(convexQuery(ref, input ?? {}));
          return [result.data, result];
        };
      }
      if (property === "ensureData") {
        const ref = realRefs[key as keyof typeof realRefs];
        return async (input?: Record<string, unknown>) => {
          if (!ref && !isNeutral(key)) neutral(key);
          if (!ref) return Promise.resolve(neutralData(key));
          return convexClient.query(ref, input ?? {});
        };
      }
      if (property === "getData")
        return () => (isNeutral(key) ? neutralData(key) : undefined);
      if (property === "useMutation") {
        return () =>
          useTanstackMutation({
            mutationFn: async () => {
              if (isNeutral(key)) return null;
              return neutral(key);
            },
          });
      }
      if (property === "invalidate") return async () => undefined;
      return procedure([...path, String(property)]);
    },
  });
}

export const api = new Proxy(procedure([]), {
  get: (target, property) =>
    property === "useUtils" ? () => target : Reflect.get(target, property),
}) as any;

export const trpc = procedure([]);

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  return props.children;
}

export const isTRPCClientError = () => false;
