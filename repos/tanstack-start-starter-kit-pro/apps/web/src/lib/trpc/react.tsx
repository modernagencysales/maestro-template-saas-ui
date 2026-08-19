import {
  type createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
} from '@trpc/client'
import {
  createTRPCReact,
  inferReactQueryProcedureOptions,
} from '@trpc/react-query'
import superjson from 'superjson'

import type { AppRouter } from '@workspace/api'

import { getQueryClient } from '../react-query'

export type { RouterInputs, RouterOutputs } from '@workspace/api/types'

export { TRPCClientError } from '@trpc/client'

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return window.location.origin
  if (import.meta.env.VITE_URL) return `https://${import.meta.env.VITE_URL}`
  return `http://localhost:${import.meta.env.PORT ?? 3000}`
}

export const api = createTRPCReact<AppRouter>()

export type ReactQueryOptions = inferReactQueryProcedureOptions<AppRouter>

let trpcClient: ReturnType<typeof createTRPCClient<AppRouter>>

export function getTrpcClient(options?: { headers?: Record<string, any> }) {
  const isSSR = typeof window === 'undefined'

  if (!trpcClient || isSSR) {
    trpcClient = api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            import.meta.env.DEV ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: superjson,
          url: getBaseUrl() + '/api/trpc',
          async headers() {
            return {
              'x-trpc-source': isSSR ? 'ssr' : 'react',
              ...options?.headers,
            }
          },
        }),
      ],
    })
  }

  return trpcClient
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  const trpcClient = getTrpcClient()

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      {props.children}
    </api.Provider>
  )
}

export function useTRPC() {
  return api.useUtils()
}

export { isTRPCClientError } from './utils'
