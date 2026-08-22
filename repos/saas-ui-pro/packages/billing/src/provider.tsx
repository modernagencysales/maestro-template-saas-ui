'use client'

import React from 'react'

import { isAfter } from 'date-fns'

export type BillingStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'

export type BillingInterval = 'day' | 'week' | 'month' | 'year'

export interface BillingFeature {
  /**
   * The feature id, eg. users
   */
  id: string
  /**
   * Optional marketing label for the feature.
   */
  label?: string
  /**
   * The billing provider price ID.
   */
  priceId?: string
  /**
   * The price of the feature, eg. 10
   */
  price?: number
  /**
   * The tiers of the feature, eg. [{ upTo: 10, price: 10 }]
   */
  tiers?: BillingPlanTier[]
  /**
   * The type of feature, eg. per_unit
   * Required when priceId is set.
   */
  type?: 'per_unit' | 'metered'
  /**
   * The limit of the feature, eg. 10
   */
  limit?: number
}

export interface BillingPlanTier {
  upTo: number | 'inf'
  price: number
}

export interface BillingPlan<MetaData = Record<string, any>> {
  /**
   * The plan id, eg. pro@1
   */
  id: string
  /**
   * The name of the plan, eg. Professional
   */
  name: string
  /**
   * The description of the plan.
   */
  description: string
  /**
   * Base price of the plan.
   */
  price?: number
  /**
   * The currency of the plan, eg. EUR or USD
   */
  currency: string
  /**
   * Wether the plan is active or not.
   */
  active: boolean
  /**
   * The billing interval, eg. month
   */
  interval: BillingInterval
  /**
   * The trial period in days.
   */
  trialDays?: number
  /**
   * The features of the plan.
   */
  features: BillingFeature[]
  /**
   * Additional metadata for the plan.
   */
  metadata: MetaData
}

export interface BillingOptions {
  plans: BillingPlan[]
  planId?: string
  status?: BillingStatus
  startedAt?: Date
  trialEndsAt?: Date
  cancelAt?: Date
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: Date
}

interface BillingContextValue extends BillingOptions {
  isReady: boolean
  isTrialing: boolean
  isCanceled: boolean
  isTrialExpired?: boolean
  currentPlan?: BillingPlan
}

export const BillingContext = React.createContext<BillingContextValue | null>(
  null,
)

export interface BillingProviderProps {
  value: BillingOptions
  children: React.ReactNode
}

export const BillingProvider: React.FC<BillingProviderProps> = (props) => {
  const { children, value } = props

  const { plans, planId, status, trialEndsAt } = props.value

  const context = React.useMemo(() => {
    const isTrialing = status === 'trialing'
    const isTrialExpired = trialEndsAt && isAfter(new Date(), trialEndsAt)

    const currentPlan = plans.find(({ id }: any) => planId === id)

    return {
      ...value,
      isReady: true,
      isTrialing,
      isTrialExpired,
      isCanceled: status === 'canceled',
      currentPlan,
    }
  }, [plans, planId, status, trialEndsAt])

  return (
    <BillingContext.Provider value={context}>
      {children}
    </BillingContext.Provider>
  )
}

export const useBilling = () => {
  return React.useContext(BillingContext) as BillingContextValue
}

export const useIsTrialing = () => {
  const { status } = useBilling()

  return status === 'trialing'
}

export const useCurrentPlan = () => {
  const { currentPlan } = useBilling()
  return currentPlan
}
