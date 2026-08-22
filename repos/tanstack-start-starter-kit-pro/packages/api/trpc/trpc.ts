/**
 * You won't need to edit this file unless you want to
 * create new middlewares or base procedures for your API.
 */
import { TRPCError, initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'

import { withAdapters } from '#adapters/context'
import { getWorkspaceContext } from '#modules/workspaces/workspaces.service'
import { ServiceError } from '#utils/error'

import { createTRPCContext } from './context'

export { TRPCError }

/**
 * Custom meta data for tRPC procedures
 */
export type TRPCMeta = {
  roles: string[]
}

/**
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC
  .context<typeof createTRPCContext>()
  .meta<TRPCMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          cause: error.cause instanceof ServiceError ? error.cause.code : null,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      }
    },
  })

/**
 * Create a server-side caller
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router

/**
 * Base procedure
 *
 * This is the base procedure that all procedures should inherit from.
 * It adds the adapters context and handles the ServiceError and wraps it in a TRPCError.
 */
const procedure = t.procedure.use(async ({ ctx, next }) => {
  const resp = await withAdapters(ctx, () =>
    next({
      ctx,
    }),
  )

  if (!resp.ok && resp.error.cause instanceof ServiceError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      cause: resp.error.cause,
    })
  }

  return resp
})

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = procedure

/**
 * Reusable middleware that enforces users are logged in before running the
 * procedure
 */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})

/**
 * Protected (authed) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use
 * this. It verifies the session is valid and guarantees ctx.session.user is not
 * null
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = procedure.use(enforceUserIsAuthed)

const scopedProcedure = protectedProcedure
  .input((input) => {
    return input as {
      workspaceId: string
    }
  })
  .use(async (opts) => {
    const { input, ctx } = opts

    if (!input.workspaceId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Workspace ID is required',
      })
    }

    const context = await getWorkspaceContext(
      input.workspaceId,
      ctx.session.user.id,
    )

    if (!context) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Workspace not found',
      })
    }

    const { member, ...workspace } = context

    if (!member) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not a member of this workspace',
      })
    }

    if (member.status !== 'active') {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not an active member of this workspace',
      })
    }

    if (opts.meta) {
      const { roles } = opts.meta
      if (roles.length && !roles.includes(member.role)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have the required role to access this resource',
        })
      }
    }

    /**
     * This is a bit of a hack, but allows us to seamlessly support
     * both workspace id and slug in the workspaceId input variable.
     */
    input.workspaceId = workspace.id

    return opts.next({
      input,
      ctx: {
        workspace,
        workspaceMember: member,
      },
    })
  })

/**
 * Workspace procedure
 *
 * Procedure that enforces the user is a member of the workspace.
 *
 * @input workspaceId - The ID or slug of the workspace to scope the procedure to.
 */
export const workspaceProcedure = protectedProcedure.concat(scopedProcedure)

/**
 * Admin procedure
 *
 * Procedure that enforces the user is an admin of the workspace.
 *
 * @input workspaceId - The ID or slug of the workspace to scope the procedure to.
 */
export const adminProcedure = protectedProcedure.concat(scopedProcedure).meta({
  roles: ['admin'],
})
