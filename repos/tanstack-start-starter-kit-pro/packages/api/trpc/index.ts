// sort-imports-ignore
// make sure .trpc.ts is imported before router.ts
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

import {
  TRPCError,
  adminProcedure,
  createCallerFactory,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  workspaceProcedure,
} from './trpc'

import { createTRPCContext } from './context'
import type { AppRouter } from './router'
import { appRouter } from './router'

/**
 * Create a server-side caller for the tRPC API
 * @example
 * const trpc = createCaller(createContext)
 * const res = await trpc.post.all()
 *       ^? Post[]
 */
const createCaller = createCallerFactory(appRouter)

/**
 * Inference helpers for input types
 * @example type HelloInput = RouterInputs['example']['hello']
 **/
type RouterInputs = inferRouterInputs<AppRouter>

/**
 * Inference helpers for output types
 * @example type HelloOutput = RouterOutputs['example']['hello']
 **/
type RouterOutputs = inferRouterOutputs<AppRouter>

export {
  appRouter,
  createCaller,
  createTRPCContext,
  createTRPCRouter,
  TRPCError,
  publicProcedure,
  protectedProcedure,
  workspaceProcedure,
  adminProcedure,
}

export type { AppRouter, RouterInputs, RouterOutputs }

export { createRequestHandler } from './server'
