import * as userService from '#modules/users/users.service'
import { createTRPCRouter, protectedProcedure } from '#trpc'

import * as authService from './auth.service.ts'

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    return await userService.userById(ctx.session.user.id)
  }),
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    return await authService.listAccounts(ctx.session.user.id)
  }),
})
