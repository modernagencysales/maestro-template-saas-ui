import { createFileRoute } from '@tanstack/react-router'

import { createStripeWebhookHandler } from '@workspace/billing-stripe'

export const Route = createFileRoute('/api/webhooks/stripe')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        createStripeWebhookHandler({
          onEvent: async (event) => {
            console.log('event', event)
          },
          debug: true,
        })(request),
    },
  },
})
