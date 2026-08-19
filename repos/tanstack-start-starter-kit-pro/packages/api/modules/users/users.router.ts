import { z } from 'zod'

import { createTRPCRouter, protectedProcedure } from '#trpc'

import { UpdateUserProfileSchema } from './users.schema'
import { updateUserProfileById } from './users.service'

export const usersRouter = createTRPCRouter({
  updateProfile: protectedProcedure
    .input(UpdateUserProfileSchema.pick({ locale: true }))
    .mutation(async ({ ctx, input }) => {
      await updateUserProfileById({
        id: ctx.session.user.id,
        locale: input.locale,
      })
    }),
  subscribeToNewsletter: protectedProcedure
    .input(z.object({ newsletter: z.boolean() }))
    .mutation(() => {
      // not implemented
    }),
})
