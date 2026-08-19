import { z } from 'zod'

import {
  TRPCError,
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from '#trpc'

import { CreateWorkspaceSchema } from './workspaces.schema'
import {
  createWorkspace,
  getWorkspace,
  isSlugAvailable,
  updateWorkspaceById,
} from './workspaces.service'

export const workspacesRouter = createTRPCRouter({
  /**
   * Create a new workspace
   */
  create: protectedProcedure
    .input(CreateWorkspaceSchema.omit({ ownerId: true }))
    .mutation(async ({ ctx, input }) => {
      const isAvailable = await isSlugAvailable(input.slug)

      if (!isAvailable) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Workspace url is already taken',
        })
      }

      return createWorkspace({
        ...input,
        ownerId: ctx.session.user.id,
      })
    }),

  /**
   * Get a workspace by slug
   */
  bySlug: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const workspace = await getWorkspace(input.slug)

      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workspace not found',
        })
      }

      if (!workspace.members?.find((m) => m.id === ctx.session.user.id)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not a member of this workspace',
        })
      }

      return workspace
    }),

  /**
   * Check if a slug is available
   */
  slugAvailable: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return {
        available: await isSlugAvailable(input.slug),
      }
    }),

  /**
   * Update a workspace
   */
  update: adminProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1, 'Please enter your workspace name.')
          .min(2, 'Please choose a name with at least 3 characters.')
          .max(50, 'The name should be no longer than 50 characters.')
          .describe('Name'),
        slug: z
          .string()
          .min(1, 'Please enter your workspace URL.')
          .min(2, 'Please choose an URL with at least 3 characters.')
          .max(50, 'The URL should be no longer than 50 characters.')
          .describe('URL')
          .regex(
            /^[a-z0-9-]+$/,
            'The URL should only contain lowercase letters, numbers, and dashes.',
          ),
      }),
    )
    .mutation(async ({ input }) => {
      return updateWorkspaceById({
        id: input.workspaceId,
        name: input.name,
        slug: input.slug,
      })
    }),
})
