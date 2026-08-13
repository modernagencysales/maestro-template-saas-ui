import { demoUser, demoWorkspace } from "#lib/backend-fixtures";

type Procedure = any;

const query = (path: readonly string[], input?: Procedure): Procedure => {
  switch (path.join(".")) {
    case "auth.me":
      return demoUser;
    case "workspaces.bySlug":
      return input?.slug === demoWorkspace.slug ? demoWorkspace : null;
    case "workspaceMembers.list":
      return [
        {
          id: demoUser.id,
          email: demoUser.email,
          name: demoUser.name,
          avatar: demoUser.image,
          roles: ["admin"],
          status: "active",
        },
      ];
    case "billing.plans":
      return [];
    case "billing.account":
      return { id: demoWorkspace.id, email: demoUser.email };
    case "billing.listInvoices":
      return [];
    default:
      return undefined;
  }
};

const procedure = (path: readonly string[]): Procedure =>
  new Proxy(() => undefined, {
    get: (_target, property) => {
      if (property === "useQuery")
        return (input?: Procedure) => ({
          data: query(path, input),
          isLoading: false,
          isPending: false,
        });
      if (property === "useSuspenseQuery")
        return (input?: Procedure) => [
          query(path, input),
          { data: query(path, input) },
        ];
      if (property === "useMutation")
        return () => ({
          mutate: () => undefined,
          mutateAsync: async () => undefined,
          isPending: false,
          reset: () => undefined,
        });
      if (property === "ensureData")
        return async (input?: Procedure) => query(path, input);
      if (property === "getData")
        return (input?: Procedure) => query(path, input);
      if (property === "invalidate") return async () => undefined;
      return procedure([...path, String(property)]);
    },
  });

export const api = new Proxy(procedure([]), {
  get: (target, property) =>
    property === "useUtils" ? () => target : Reflect.get(target, property),
}) as Procedure;

export const trpc = procedure([]);

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  return props.children;
}

export const isTRPCClientError = () => false;
