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

const queryResults = new Map<string, QueryResult>();

function queryContactFixture(
  path: readonly string[],
  input?: UntypedProcedure,
): UntypedProcedure {
  switch (path.join(".")) {
    case "contacts.listByType":
      return { contacts: goldenFixtures.contacts };
    case "contacts.byId":
      return (
        goldenFixtures.contacts.find((contact) => contact.id === input?.id) ??
        goldenFixtures.contacts[0]
      );
    case "contacts.activitiesById":
      return {
        activities: [
          {
            id: `activity-${input?.id ?? "contact-1"}`,
            type: "action",
            actorId: "user-1",
            metadata: { action: "created-contact" },
            createdAt: "2026-01-12T09:00:00.000Z",
          },
        ],
      };
    default:
      return undefined;
  }
}

function queryFixture(
  path: readonly string[],
  input?: UntypedProcedure,
): UntypedProcedure {
  switch (path.join(".")) {
    case "contacts.listByType":
    case "contacts.byId":
    case "contacts.activitiesById":
      return queryContactFixture(path, input);
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
          return (input?: UntypedProcedure) => {
            const key = `${path.join(".")}:${JSON.stringify(input)}`;
            let query = queryResults.get(key);
            if (!query) {
              query = result(queryFixture(path, input));
              queryResults.set(key, query);
            }
            return query;
          };
        }
        if (property === "useSuspenseQuery") {
          return (input?: UntypedProcedure) => {
            const data = queryFixture(path, input);
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
        if (property === "getData")
          return (input?: UntypedProcedure) => queryFixture(path, input);
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
