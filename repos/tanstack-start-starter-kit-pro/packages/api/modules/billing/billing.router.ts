import { z } from 'zod'

import {
  TRPCError,
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from '#trpc'

import { UpdateBillingAccountSchema } from './billing.schema'
import {
  createBillingPortalSession,
  createCheckoutSession,
  getAccount,
  getFeatureCounts,
  listPlans,
  updateAccount,
  upsertAccount,
} from './billing.service'

export const billingRouter = createTRPCRouter({
  /**
   * Get available billing plans
   * @public
   */
  plans: publicProcedure.query(async () => {
    return listPlans()
  }),

  /**
   * Get the billing account information
   */
  account: adminProcedure.query(async ({ input }) => {
    return getAccount(input.workspaceId)
  }),

  /**
   * Update billing details
   */
  updateBillingDetails: adminProcedure
    .input(UpdateBillingAccountSchema.pick({ email: true }))
    .mutation(async ({ input, ctx }) => {
      const account = await getAccount(input.workspaceId)

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        })
      }

      let customerId = account.customerId

      if (!customerId && ctx.adapters.billing?.createCustomer) {
        customerId = await ctx.adapters.billing.createCustomer?.({
          accountId: input.workspaceId,
          name: ctx.workspace?.name,
          email: input?.email ?? undefined,
        })

        await upsertAccount({
          id: input.workspaceId,
          email: input.email,
          customerId,
        })

        return
      }

      await updateAccount({
        id: input.workspaceId,
        email: input.email,
      })

      if (
        ctx.adapters.billing?.updateCustomer &&
        input.email &&
        account.customerId
      ) {
        await ctx.adapters.billing?.updateCustomer({
          customerId: account.customerId,
          accountId: account.id,
          name: ctx.workspace?.name,
          email: input.email,
        })
      }
    }),

  /**
   * List invoices for a customer (workspace)
   */
  listInvoices: adminProcedure.query(async ({ input, ctx }) => {
    const account = await getAccount(input.workspaceId)

    if (!account) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Account not found',
      })
    }

    if (!account?.customerId) {
      return []
    }

    return await ctx.adapters.billing?.listInvoices?.({
      customerId: account?.customerId,
    })
  }),

  setSubscriptionPlan: adminProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        planId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.adapters.billing?.updateSubscription) {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'Updating subscriptions is not supported',
        })
      }

      const account = await getAccount(input.workspaceId)

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        })
      }

      if (!account?.customerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Customer ID not found',
        })
      }

      if (!account?.subscription) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Account has no subscription',
        })
      }

      const counts = await getFeatureCounts({
        accountId: input.workspaceId,
      })

      await ctx.adapters.billing?.updateSubscription?.({
        subscriptionId: account.subscription.id,
        planId: input.planId,
        counts,
      })
    }),

  createCheckoutSession: adminProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        planId: z.string(),
        successUrl: z.string(),
        cancelUrl: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return createCheckoutSession({
        ...input,
        email: ctx.session.user.email ?? undefined,
        name: ctx.workspace?.name,
      })
    }),

  createBillingPortalSession: adminProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        returnUrl: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return createBillingPortalSession({
        ...input,
        email: ctx.session.user.email ?? undefined,
        name: ctx.workspace?.name,
      })
    }),
})
