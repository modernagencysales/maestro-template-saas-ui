import type { ApiAdapters } from '@workspace/api'
import { createStripeAdapter } from '@workspace/billing-stripe'

export const createAdapters = (): ApiAdapters => {
  return {
    billing: createStripeAdapter(),
  }
}
