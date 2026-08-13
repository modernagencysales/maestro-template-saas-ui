import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

let queryClient: QueryClient;

export const getQueryClient = () => {
  if (!queryClient || typeof window === "undefined") {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30 * 1000,
        },
        dehydrate: { serializeData: superjson.serialize },
        hydrate: { deserializeData: superjson.deserialize },
      },
    });
  }

  return queryClient;
};
