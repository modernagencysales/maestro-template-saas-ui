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

const result = (): QueryResult => ({ isLoading: false, isPending: false });
const procedure = {
  useQuery: () => result(),
  useSuspenseQuery: () => [undefined, result()],
  useMutation: () => ({
    mutate: () => undefined,
    mutateAsync: async () => undefined,
    isPending: false,
  }),
};
const endpoint = new Proxy(procedure, {
  get: (target, property, receiver) =>
    typeof property === "string" && property in target
      ? Reflect.get(target, property, receiver)
      : endpoint,
}) as UntypedProcedure;

export const api = new Proxy(endpoint, {
  get: (target, property) =>
    property === "useUtils" ? () => endpoint : Reflect.get(target, property),
}) as UntypedProcedure;

export const isTRPCClientError = () => false;
