import { env } from 'env'

import Stripe from 'stripe'

import { StripeAdapter } from './stripe.adapter'

const webhookEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export const createStripeWebhookHandler =
  (options: {
    onEvent?: (event: Stripe.Event) => Promise<void>
    debug?: boolean
  }) =>
  async (req: Request) => {
    const signature = req.headers.get('stripe-signature')

    const adapter = new StripeAdapter()

    const event = adapter.stripe.webhooks.constructEvent(
      await req.text(),
      signature ?? '',
      env.STRIPE_WEBHOOK_SECRET ?? '',
    )

    if (options.debug) {
      console.log('[Stripe] Received event:', event)
    }

    if (webhookEvents.has(event.type)) {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription
          await adapter.syncSubscriptionStatus({
            subscriptionId: subscription.id,
          })
          break
        }
        case 'checkout.session.completed': {
          const checkoutSession = event.data.object as Stripe.Checkout.Session
          if (
            checkoutSession.mode === 'subscription' &&
            checkoutSession.subscription
          ) {
            const subscriptionId =
              typeof checkoutSession.subscription === 'string'
                ? checkoutSession.subscription
                : checkoutSession.subscription.id

            await adapter.syncSubscriptionStatus({
              subscriptionId,
              initial: true,
            })
          }
          break
        }
        default: {
          console.log('[Stripe] Unhandled event:', event)
        }
      }
    }

    if (options.onEvent) {
      await options.onEvent(event)
    }

    return Response.json({ received: true })
  }
