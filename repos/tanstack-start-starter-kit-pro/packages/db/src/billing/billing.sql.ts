import {
  boolean,
  jsonb,
  pgEnum,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { pgTable } from '../_table'
import { id, timestamps } from '../utils'

export type FeatureIds = string

export type FeatureType = 'per_unit' | 'metered'

export type Feature = {
  id: FeatureIds
  priceId?: string
  type?: FeatureType
  limit?: number | null
}

// These statuses map directly to Stripe's subscription statuses
// @see https://stripe.com/docs/api/subscriptions/object#subscription_object-status
const statuses = [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
] as const

export type SubscriptionStatus = (typeof statuses)[number]

export const billingSubscriptionStatus = pgEnum(
  'billing_subscription_status',
  statuses,
)

export const billingSubscriptions = pgTable('billing_subscriptions', {
  id: varchar('id', { length: 255 }).notNull().primaryKey(),
  accountId: varchar('account_id', { length: 255 })
    .notNull()
    .references(() => billingAccounts.id, {
      onDelete: 'cascade',
    }),
  planId: varchar('plan_id', { length: 255 }).notNull(),
  status: billingSubscriptionStatus('status').notNull(),
  quantity: real('quantity').notNull(),
  startedAt: timestamp('started_at').notNull(),
  cancelAt: timestamp('cancel_at', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  currentPeriodStart: timestamp('current_period_start', {
    withTimezone: true,
  }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', {
    withTimezone: true,
  }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<{ [key: string]: string }>(),
  ...timestamps,
})

export const billingPlansInterval = pgEnum('billing_plans_interval', [
  'day',
  'week',
  'month',
  'year',
])

export const billingPlans = pgTable('billing_plans', {
  id: varchar('id', { length: 255 }).notNull().primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }),
  active: boolean('active').notNull().default(true),
  price: real('price'),
  currency: varchar('currency', { length: 20 }).notNull().default('USD'),
  interval: billingPlansInterval('interval').notNull().default('month'),
  trialPeriodDays: real('trial_period_days'),
  features: jsonb('features').$type<Feature[]>(),
  metadata: jsonb('metadata').$type<{ [key: string]: string }>(),
  ...timestamps,
})

export const billingAccounts = pgTable('billing_accounts', {
  ...id,
  // eg. Stripe customer ID
  customerId: varchar('customer_id', { length: 255 }).unique(),
  email: varchar('email', { length: 255 }),
  ...timestamps,
})

export const billingEntitlements = pgTable(
  'billing_entitlements',
  {
    ...id,
    accountId: varchar('account_id', { length: 255 })
      .notNull()
      .references(() => billingAccounts.id, {
        onDelete: 'cascade',
      }),
    feature: text('feature').notNull(),
    enabled: boolean('enabled').default(true),
    limit: real('limit'),
  },
  (t) => [uniqueIndex('billing_entitlements_idx').on(t.accountId, t.feature)],
)
