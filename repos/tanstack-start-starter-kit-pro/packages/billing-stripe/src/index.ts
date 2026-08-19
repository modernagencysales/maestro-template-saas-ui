import { env } from 'env'

import { StripeAdapter } from './stripe.adapter'

export { createStripeWebhookHandler } from './stripe.webhook'

export function createStripeAdapter() {
  if (!env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY is not set, billing adapter not enabled.')
    return undefined
  }

  return new StripeAdapter()
}
