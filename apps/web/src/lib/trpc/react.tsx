import { convexQuery, useConvexQuery } from "@convex-dev/react-query";
import { ConvexReactClient } from "convex/react";
import {
  useQuery,
  useMutation as useTanstackMutation,
} from "@tanstack/react-query";
import { templateConfectRefs } from "../../../../../packages/convex/src/refs";
import type React from "react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
export const convexClient = convexUrl
  ? new ConvexReactClient(convexUrl)
  : new Proxy({} as ConvexReactClient, {
      get() {
        throw new Error("VITE_CONVEX_URL is required for Convex access");
      },
    });

const refs = templateConfectRefs as any;
export const realRefs = {
  "auth.me": refs.public.auth.workspaces.me,
  "workspaces.bySlug": refs.public.auth.workspaces.bySlug,
  "workspaceMembers.list": refs.public.access.members.list,
};

const neutral = (path: string) => {
  throw new Error(`No Convex authority is registered for ${path}`);
};
export const assertRealAuthority = (path: string) => {
  if (!(path in realRefs)) neutral(path);
};

function procedure(path: string[]): any {
  const key = path.join(".");
  return new Proxy(() => undefined, {
    get: (_target, property) => {
      if (property === "useQuery") {
        const ref = realRefs[key as keyof typeof realRefs];
        return (input?: Record<string, unknown>) => {
          if (!ref) neutral(key);
          return useConvexQuery(ref, input ?? {});
        };
      }
      if (property === "useSuspenseQuery") {
        const ref = realRefs[key as keyof typeof realRefs];
        return (input?: Record<string, unknown>) => {
          if (!ref) neutral(key);
          const result = useQuery(convexQuery(ref, input ?? {}));
          return [result.data, result];
        };
      }
      if (property === "ensureData") {
        const ref = realRefs[key as keyof typeof realRefs];
        return async (input?: Record<string, unknown>) => {
          if (!ref) neutral(key);
          return convexClient.query(ref, input ?? {});
        };
      }
      if (property === "getData") return () => undefined;
      if (property === "useMutation") {
        return () =>
          useTanstackMutation({ mutationFn: async () => neutral(key) });
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
