/**
 * This files defines the "contexts" that are available in the backend API.
 *
 * It allows you to access things when processing a request, like the database, the session, etc.
 */
import { db } from '@workspace/db'

import { ApiAdapters } from '#adapters'

import { Session } from '../types'

/**
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async <
  TSession extends Session = Session,
  Adapters extends ApiAdapters = ApiAdapters,
>(opts: {
  headers: Headers
  session: TSession | null
  adapters: Adapters
  debug?: boolean
}) => {
  const { session, adapters, debug } = opts

  const logger = {
    info: console.log,
    error: console.error,
    debug: (...args: any[]) => {
      if (debug) {
        console.log(...args)
      }
    },
  }

  if (debug) {
    const source = opts.headers.get('x-trpc-source') ?? 'unknown'
    console.log('>>> tRPC Request from', source, 'by', session?.user)
  }

  return {
    session,
    db,
    adapters,
    logger,
  }
}
