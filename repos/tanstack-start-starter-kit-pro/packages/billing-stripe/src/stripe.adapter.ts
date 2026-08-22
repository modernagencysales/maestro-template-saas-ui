import Stripe from 'stripe'

import * as billingService from '@workspace/api/modules/billing/billing.service'
import type { BillingAdapter } from '@workspace/api'

import pkg from '../package.json'
import { toISODateTime } from './utils'

export class StripeAdapter implements BillingAdapter {
  public stripe: Stripe

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2025-11-17.clover',
      appInfo: {
        name: pkg.name,
        version: pkg.version,
      },
    })
  }

  async findCustomerId(params: {
    id?: string
    accountId?: string
    email?: string
  }) {
    if (params.id) {
      const customer = await this.stripe.customers.retrieve(params.id)

      return customer.id
    }

    if (params.email) {
      const customers = await this.stripe.customers.list({
        limit: 1,
        email: params.email,
      })

      return customers.data[0]?.id ?? null
    }

    if (params.accountId) {
      const customers = await this.stripe.customers.search({
        query: `metadata['accountId']:'${params.accountId}'`,
      })

      return customers.data[0]?.id ?? null
    }

    return null
  }

  async createCustomer(params: {
    accountId: string
    email?: string
    name?: string
  }) {
    const customer = await this.stripe.customers.create({
      name: params.name ?? params.accountId,
      email: params.email,
      metadata: {
        accountId: params.accountId,
      },
    })

    return customer.id
  }

  async updateCustomer(params: {
    customerId: string
    accountId: string
    email?: string
    name?: string
  }) {
    await this.stripe.customers.update(params.customerId, {
      name: params.name,
      email: params.email,
      metadata: {
        accountId: params.accountId,
      },
    })
  }

  async createCheckoutSession(params: {
    customerId: string
    planId: string
    counts?: Record<string, number>
    successUrl: string
    cancelUrl: string
  }) {
    const plan = await billingService.getPlan(params.planId)

    if (!plan || !plan.active) {
      throw new Error(`Plan ${params.planId} not found`)
    }

    const lineItems = plan.features
      ?.filter((feature) => feature.priceId)
      .map((feature) => {
        return {
          price: feature.priceId,
          quantity:
            feature.type === 'per_unit'
              ? (params.counts?.[feature.id] ?? 1)
              : undefined,
        } satisfies Stripe.Checkout.SessionCreateParams.LineItem
      })

    if (!lineItems || lineItems.length === 0) {
      throw new Error('Invalid pricing plan')
    }

    const response = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      customer: params.customerId,
      line_items: lineItems,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          planId: params.planId,
        },
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    })

    return {
      id: response.id,
      url: response.url ?? undefined,
    }
  }

  async syncSubscriptionStatus(params: {
    subscriptionId: string
    initial?: boolean
  }) {
    const subscription = await this.stripe.subscriptions.retrieve(
      params.subscriptionId,
      {
        expand: ['default_payment_method', 'customer'],
      },
    )

    const customer = subscription.customer as Stripe.Customer

    const account = await billingService.getAccountByCustomerId(customer.id)

    if (!account) {
      throw new Error(`No billing account found for customer ${customer.id}`)
    }

    const planId = subscription.metadata.planId

    if (!planId) {
      throw new Error(
        `Plan for price id ${subscription.items.data[0].price.id} not found`,
      )
    }

    // Get current period from the first subscription item
    // Stripe moved current_period_start and current_period_end to subscription items
    const firstItem = subscription.items.data[0]
    if (!firstItem) {
      throw new Error(
        `No subscription items found for subscription ${params.subscriptionId}`,
      )
    }

    // Access period information from subscription item (moved from subscription level)
    const currentPeriodStart = firstItem.current_period_start
    const currentPeriodEnd = firstItem.current_period_end

    if (currentPeriodStart === undefined || currentPeriodEnd === undefined) {
      throw new Error(
        `Missing period information for subscription ${params.subscriptionId}`,
      )
    }

    await billingService.upsertSubscription({
      id: params.subscriptionId,
      accountId: account.id,
      planId,
      metadata: subscription.metadata,
      status: subscription.status,
      quantity: 1,
      startedAt: toISODateTime(subscription.start_date),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at
        ? toISODateTime(subscription.cancel_at)
        : null,
      canceledAt: subscription.canceled_at
        ? toISODateTime(subscription.canceled_at)
        : null,
      currentPeriodStart: toISODateTime(currentPeriodStart),
      currentPeriodEnd: toISODateTime(currentPeriodEnd),
      createdAt: toISODateTime(subscription.created),
      endedAt: subscription.ended_at
        ? toISODateTime(subscription.ended_at)
        : null,
      trialEndsAt: subscription.trial_end
        ? toISODateTime(subscription.trial_end)
        : null,
    })

    if (params.initial) {
      await billingService.updateAccount({
        id: account.id,
        customerId: customer.id,
        email: customer.email,
      })
    }
  }

  async updateSubscription(params: {
    subscriptionId: string
    planId: string
    status?: string
    counts?: Record<string, number>
  }) {
    const subscription = await this.stripe.subscriptions.retrieve(
      params.subscriptionId,
    )

    const plan = await billingService.getPlan(params.planId)

    if (!plan) {
      throw new Error(`Plan ${params.planId} not found`)
    }

    const lineItems = plan.features
      ?.filter((feature) => feature.priceId)
      .map((feature, i) => {
        const quantity = subscription.items.data[i].quantity
        return {
          id: subscription.items.data[i].id,
          price: feature.priceId,
          quantity:
            feature.type === 'per_unit'
              ? (params.counts?.[feature.id] ?? quantity)
              : undefined,
        }
      })

    if (!lineItems || lineItems.length === 0) {
      throw new Error('Invalid pricing plan')
    }

    await this.stripe.subscriptions.update(params.subscriptionId, {
      items: lineItems,
      metadata: {
        planId: params.planId,
      },
    })

    await this.syncSubscriptionStatus({
      subscriptionId: params.subscriptionId,
    })
  }

  async createBillingPortalSession(params: {
    customerId: string
    returnUrl: string
  }) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    })

    return {
      url: session.url,
    }
  }

  async listInvoices(params: { customerId: string }) {
    const invoices = await this.stripe.invoices.list({
      customer: params.customerId,
    })

    return invoices.data.map((invoice) => {
      return {
        number: invoice.number!,
        date: new Date(invoice.created * 1000),
        status: invoice.status as string,
        total: invoice.total / 100,
        currency: invoice.currency,
        url: invoice.hosted_invoice_url ?? undefined,
      }
    })
  }

  async registerUsage(params: {
    customerId: string
    featureId: string
    quantity: number
  }) {
    await this.stripe.billing.meterEvents.create({
      event_name: params.featureId,
      payload: {
        value: String(params.quantity),
        stripe_customer_id: params.customerId,
      },
    })
  }
}
