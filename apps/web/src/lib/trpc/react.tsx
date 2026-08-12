type QueryResult = {
  data?: unknown;
  isLoading: boolean;
  isPending: boolean;
  error?: unknown;
};

const result = (): QueryResult => ({ isLoading: false, isPending: false });
const endpoint = new Proxy(
  {},
  {
    get: () => ({
      useQuery: () => result(),
      useSuspenseQuery: () => [undefined, result()],
      useMutation: () => ({
        mutate: () => undefined,
        mutateAsync: async () => undefined,
        isPending: false,
      }),
    }),
  },
) as any;

export const api = new Proxy(endpoint, {
  get: (target, property) =>
    property === "useUtils" ? () => endpoint : Reflect.get(target, property),
}) as any;

export const isTRPCClientError = () => false;
