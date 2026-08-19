import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

import type { ApiAdapters } from '#adapters'
import type { Session } from '#types'

import { createTRPCContext } from './context'
import { appRouter } from './router'

export const createRequestHandler = <
  TSession extends Session = Session,
  Adapters extends ApiAdapters = ApiAdapters,
>(options: {
  endpoint: string
  req: Request
  getSession: (req: Request) => Promise<TSession | null>
  adapters: Adapters
  debug?: boolean
}) => {
  return fetchRequestHandler({
    endpoint: options.endpoint ?? '/api/trpc',
    req: options.req,
    router: appRouter,
    createContext: async () => {
      const session = await options.getSession(options.req)
      console.log('session', session)
      return createTRPCContext({
        headers: options.req.headers,
        session,
        adapters: options.adapters,
        debug: options.debug ?? false,
      })
    },
  })
}
