import { goldenFixtures } from "#features/golden/fixtures";

type QueryResult = {
  data?: UntypedProcedure;
  isLoading: boolean;
  isPending: boolean;
  error?: unknown;
};

// The projected upstream screens use arbitrary tRPC nesting until a generated
// client replaces this fake facade. TODO(template-gap): generate typed refs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedProcedure = any;

const result = (data?: UntypedProcedure): QueryResult => ({
  ...(data === undefined ? {} : { data }),
  isLoading: false,
  isPending: false,
});

function queryFixture(path: readonly string[]): UntypedProcedure {
  switch (path.join(".")) {
    case "contacts.listByType":
      return { contacts: goldenFixtures.contacts };
    case "contacts.byId":
      return goldenFixtures.contacts[0];
    case "notifications.inbox":
      return { notifications: goldenFixtures.notifications };
    case "billing.account":
      return { email: goldenFixtures.billing.email };
    case "billing.listInvoices":
      return goldenFixtures.billing.invoices;
    case "workspaces.bySlug":
      return goldenFixtures.currentWorkspace;
    default:
      return undefined;
  }
}

function mutationFixture(path: readonly string[]): UntypedProcedure {
  switch (path.join(".")) {
    case "workspaces.create":
      return { slug: goldenFixtures.currentWorkspace.slug };
    case "workspaces.slugAvailable":
      return { available: true };
    case "billing.createBillingPortalSession":
      return { url: undefined };
    default:
      return undefined;
  }
}

function fakeProcedure(path: readonly string[]): UntypedProcedure {
  return new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === "useQuery") {
          return () => result(queryFixture(path));
        }
        if (property === "useSuspenseQuery") {
          return () => {
            const data = queryFixture(path);
            return [data, result(data)];
          };
        }
        if (property === "useMutation") {
          const data = mutationFixture(path);
          return () => ({
            mutate: () => data,
            mutateAsync: async () => data,
            isPending: false,
            reset: () => undefined,
          });
        }
        if (property === "getData") return () => queryFixture(path);
        if (property === "invalidate") return async () => undefined;
        return fakeProcedure([...path, String(property)]);
      },
    },
  ) as UntypedProcedure;
}

const endpoint = fakeProcedure([]);

export const api = new Proxy(endpoint, {
  get: (target, property) =>
    property === "useUtils" ? () => endpoint : Reflect.get(target, property),
}) as UntypedProcedure;

export const isTRPCClientError = () => false;
