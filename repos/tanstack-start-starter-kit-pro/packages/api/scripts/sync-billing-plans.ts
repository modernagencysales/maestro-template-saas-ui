import { plans } from '@workspace/config'

import { syncPlans } from '#modules/billing/billing.service'

/**
 * Sync your billing plan config with the billing service.
 */

console.log('Syncing billing plans...')

try {
  await syncPlans(
    plans.map((plan) => {
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        active: plan.active,
        price: plan.price,
        currency: plan.currency,
        features: plan.features?.map((feature) => ({
          id: feature.id,
          priceId: feature.priceId,
          price: feature.price,
          type: feature.type,
          limit: feature.limit,
        })),
        interval: plan.interval,
        trialPeriodDays: plan.trialDays,
        metadata: plan.metadata,
      }
    }),
  )

  console.log('Billing plans synced')
} catch (e) {
  console.error('Failed to sync billing plans', e)
}

process.exit(0)
