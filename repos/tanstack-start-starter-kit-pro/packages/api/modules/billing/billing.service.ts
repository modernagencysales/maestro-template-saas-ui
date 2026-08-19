import { startOfMonth } from 'date-fns'
import { z } from 'zod'

import {
  and,
  billingAccounts,
  billingPlans,
  billingSubscriptions,
  contacts,
  count,
  db,
  eq,
  gte,
  sql,
  workspaceMembers,
} from '@workspace/db'
import { unionAll } from '@workspace/db/utils'

import { useAdapter } from '#adapters/context'
import { ServiceError } from '#utils/error'

import {
  BillingPlanDTO,
  BillingSubscriptionDTO,
  UpdateBillingAccountSchema,
} from './billing.schema'

/**
 * Sync billing plans from a static config
 */
export const syncPlans = async (plans: BillingPlanDTO[]) => {
  return await db.transaction(async (tx) => {
    for (const plan of plans) {
      const values = {
        ...plan,
        features: sql.raw(`'${JSON.stringify(plan.features ?? [])}'::jsonb`), // FIXME this should be handled by drizzle
        metadata: sql.raw(`'${JSON.stringify(plan.metadata ?? {})}'::jsonb`), // FIXME this should be handled by drizzle
      }
      await tx.insert(billingPlans).values(values).onConflictDoUpdate({
        target: billingPlans.id,
        set: values,
      })
    }
  })
}

export const getPlan = async (id: string) => {
  return await db.query.billingPlans.findFirst({
    where: { id },
  })
}

export const getPlanByMetadata = async (key: string, value: string) => {
  return await db
    .select()
    .from(billingPlans)
    .where(sql`metadata->>${key} = ${value}`)
    .limit(1)
    .execute()
    .then((rows) => rows[0])
}

export const listPlans = async () => {
  return await db.query.billingPlans.findMany({
    where: { active: true },
  })
}

export const updateAccount = async (
  details: z.infer<typeof UpdateBillingAccountSchema>,
) => {
  const { id, ...$set } = details

  const result = await db
    .update(billingAccounts)
    .set($set)
    .where(eq(billingAccounts.id, id))
    .returning({
      id: billingAccounts.id,
    })

  return result[0]
}

export const getAccount = async (id: string) => {
  return await db.query.billingAccounts.findFirst({
    where: { id },
    with: {
      subscription: true,
    },
  })
}

export const getAccountByCustomerId = async (customerId: string) => {
  return await db.query.billingAccounts.findFirst({
    where: { customerId },
    with: {
      subscription: true,
    },
  })
}

export const upsertAccount = async (
  details: z.infer<typeof UpdateBillingAccountSchema>,
) => {
  const { id, ...$set } = details

  await db
    .insert(billingAccounts)
    .values({
      id,
      ...$set,
    })
    .onConflictDoUpdate({
      target: billingAccounts.id,
      set: $set,
    })
}

export const upsertSubscription = async (
  subscription: BillingSubscriptionDTO,
) => {
  await db
    .insert(billingSubscriptions)
    .values(subscription)
    .onConflictDoUpdate({
      target: billingSubscriptions.id,
      set: subscription,
    })
}

export const getSubscription = async (id: string) => {
  return await db.query.billingSubscriptions.findFirst({
    where: { id },
  })
}

/**
 * Get feature counts for a workspace
 */
export const getFeatureCounts = async (args: { accountId: string }) => {
  const usersCount = db
    .select({ feature: sql<string>`'users'`, count: count() })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, args.accountId),
        eq(workspaceMembers.status, 'active'),
      ),
    )

  const contactsCount = db
    .select({ feature: sql<string>`'contacts'`, count: count() })
    .from(contacts)
    .where(
      and(
        eq(contacts.workspaceId, args.accountId),
        gte(contacts.updatedAt, startOfMonth(new Date())),
      ),
    )

  const result = await unionAll(usersCount, contactsCount)

  const counts: Record<string, number> = {}
  for (const row of result) {
    counts[row.feature] = row.count
  }

  return {
    users: counts.users ?? 0,
    contacts: counts.contacts ?? 0,
  }
}

export async function limitReached(args: {
  planId: string
  featureId: string
  quantity: number
}) {
  const plan = await getPlan(args.planId)

  if (!plan) {
    return false
  }

  const feature = plan.features?.find(
    (feature) => feature.id === args.featureId,
  )

  if (!feature) {
    return false
  }

  if (feature.limit && args.quantity >= feature.limit) {
    return true
  }

  return false
}

export async function throwIfLimitReached(args: {
  planId: string
  featureId: string
  quantity: number
}) {
  if (await limitReached(args)) {
    throw new ServiceError(
      'billing.limit_reached',
      `Limit for ${args.featureId} reached`,
    )
  }
}

export const createCheckoutSession = async (args: {
  workspaceId: string
  planId: string
  successUrl: string
  cancelUrl: string
  email?: string
  name?: string
}) => {
  const billingAdapter = useAdapter('billing')

  const account = await getAccount(args.workspaceId)

  let customerId = await billingAdapter.findCustomerId({
    id: account?.customerId ?? undefined,
    accountId: args.workspaceId,
    email: args.email,
  })

  if (!customerId && billingAdapter.createCustomer) {
    customerId = await billingAdapter.createCustomer({
      accountId: args.workspaceId,
      name: args.name,
      email: args.email,
    })

    await upsertAccount({
      id: args.workspaceId,
      customerId,
    })
  } else if (customerId && !account?.customerId) {
    await upsertAccount({
      id: args.workspaceId,
      customerId,
    })
  }

  const counts = await getFeatureCounts({
    accountId: args.workspaceId,
  })

  return billingAdapter.createCheckoutSession({
    customerId: customerId ?? args.workspaceId,
    planId: args.planId,
    counts,
    successUrl: args.successUrl,
    cancelUrl: args.cancelUrl,
  })
}

export const createBillingPortalSession = async (args: {
  workspaceId: string
  name?: string
  email?: string
  returnUrl: string
}) => {
  const billingAdapter = useAdapter('billing')

  if (!billingAdapter.createBillingPortalSession) {
    throw new ServiceError(
      'billing.create_billing_portal_session_not_supported',
      'createBillingPortalSession not supported',
    )
  }

  const account = await getAccount(args.workspaceId)

  const email = account?.email ?? args.email ?? undefined

  let customerId = await billingAdapter.findCustomerId?.({
    id: account?.customerId ?? undefined,
    accountId: args.workspaceId,
    email,
  })

  if (!customerId && billingAdapter.createCustomer) {
    customerId = await billingAdapter.createCustomer?.({
      accountId: args.workspaceId,
      name: args.name,
      email,
    })

    await upsertAccount({
      id: args.workspaceId,
      customerId,
    })
  } else if (customerId && !account?.customerId) {
    await upsertAccount({
      id: args.workspaceId,
      customerId,
    })
  } else if (!customerId) {
    // if the adapter does not support upserting customers, we don't need to store the reference ID
    // but instead will use the workspace ID as a reference in checkout.
    customerId = args.workspaceId
  }

  if (!account) {
    throw new ServiceError('billing.account_not_found', 'Account not found')
  }

  if (!customerId) {
    throw new ServiceError('billing.customer_not_found', 'Customer not found')
  }

  return billingAdapter.createBillingPortalSession({
    customerId,
    returnUrl: args.returnUrl,
  })
}
