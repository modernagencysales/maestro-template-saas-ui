import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import superjson from "superjson";

let queryClient: QueryClient;

export const getQueryClient = (config?: QueryClientConfig) => {
  if (!queryClient || typeof window === "undefined") {
    queryClient = new QueryClient({
      ...config,
      defaultOptions: {
        ...config?.defaultOptions,
        queries: {
          staleTime: 30 * 1000,
          ...config?.defaultOptions?.queries,
        },
        dehydrate: {
          serializeData: superjson.serialize,
          ...config?.defaultOptions?.dehydrate,
        },
        hydrate: {
          deserializeData: superjson.deserialize,
          ...config?.defaultOptions?.hydrate,
        },
      },
    });
  }

  return queryClient;
};
