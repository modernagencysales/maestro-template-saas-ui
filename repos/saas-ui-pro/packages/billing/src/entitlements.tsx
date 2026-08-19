import { BillingFeature, useCurrentPlan } from './provider'

/**
 * Returns the entitlement for a given feature.
 */
export const useEntitlement = (featureId: string) => {
  const currentPlan = useCurrentPlan()

  return currentPlan?.features.find((feature) => feature.id === featureId)
}

/**
 * Returns whether the limit for a given feature has been reached.
 */
export const useLimitReached = (featureId: string, count: number) => {
  const feature = useEntitlement(featureId)

  return feature?.limit ? count >= feature.limit : false
}

/**
 * Renders the children if the limit for the feature has not been reached.
 */
export function LimitReached({
  featureId,
  count,
  fallback = null,
  children,
}: {
  featureId: string
  count: number
  fallback?: React.ReactNode
  children?:
    | React.ReactNode
    | ((props: { feature: BillingFeature }) => React.ReactNode)
}) {
  const feature = useEntitlement(featureId)

  const limitReached = useLimitReached(featureId, count)

  return limitReached ? fallback : runIfFn(children, { feature })
}

const runIfFn = (fn: any, ...args: any[]) =>
  typeof fn === 'function' ? fn(...args) : fn
