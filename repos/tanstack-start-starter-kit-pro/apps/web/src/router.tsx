import { createRouter as createTanstackRouter } from '@tanstack/react-router'
import { createTRPCQueryUtils } from '@trpc/react-query'

import { getQueryClient } from '#lib/react-query'
import { getTrpcClient } from '#lib/trpc/react'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = getQueryClient()

  const trpcClient = getTrpcClient()

  const trpcUtils = createTRPCQueryUtils({
    queryClient,
    client: trpcClient,
  })

  return createTanstackRouter({
    routeTree,
    context: {
      queryClient: getQueryClient(),
      trpc: trpcUtils,
    },
    defaultPreload: 'intent',
    // Since we're using React Query, we don't want loader calls to ever be stale
    // This will ensure that the loader is always called when the route is preloaded or visited
    defaultPreloadStaleTime: 0,
  })
}

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
