import type { BillingPlan } from '@saas-ui-pro/billing'

export const plans: BillingPlan[] = [
  {
    id: 'free@1',
    active: true,
    name: 'Free',
    description: 'For individuals.',
    currency: 'EUR',
    interval: 'month',
    trialDays: 0,
    features: [
      {
        id: 'users',
        priceId: 'price_1PLPKhHXr4hWIkAX7bM7NSlG',
        type: 'per_unit',
        price: 0,
        limit: 1,
      },
      {
        id: 'inbox',
      },
      {
        id: 'contacts',
      },
      {
        id: 'monthly_active_contacts',
        label: 'Max 1000 MACs',
        price: 0,
        limit: 1000,
      },
    ],
    metadata: {
      price: '€0',
      priceLabel: 'per user/month',
    },
  },
  {
    id: 'free_yearly@1',
    active: true,
    name: 'Free',
    description: 'For individuals.',
    currency: 'EUR',
    interval: 'year',
    trialDays: 0,
    features: [
      {
        id: 'users',
        priceId: 'price_1PLPKhHXr4hWIkAX7bM7NSlG',
        type: 'per_unit',
        price: 0,
        limit: 1,
      },
      {
        id: 'inbox',
      },
      {
        id: 'contacts',
      },
      {
        id: 'monthly_active_contacts',
        label: 'Max 1000 MACs',
        price: 0,
        limit: 1000,
      },
    ],
    metadata: {
      price: '€0',
      priceLabel: 'per user/month',
    },
  },
  {
    id: 'pro@1',
    active: true,
    name: 'Professional',
    description: 'For small teams.',
    currency: 'EUR',
    interval: 'month',
    trialDays: 14,
    features: [
      {
        id: 'users',
        label: 'Max 3',
        priceId: 'price_1In2xiHXr4hWIkAX7cm5A7jb',
        type: 'per_unit',
        price: 10,
        limit: 3,
      },
      {
        id: 'inbox',
      },
      {
        id: 'contacts',
      },
      {
        id: 'monthly_active_contacts',
        label: '10000 MACs included',
        priceId: 'price_1POfKwHXr4hWIkAX4VnSn4nT',
        price: 0,
        tiers: [
          {
            upTo: 10000,
            price: 0,
          },
          {
            upTo: 100000,
            price: 0.0001,
          },
          {
            upTo: 'inf',
            price: 0.00005,
          },
        ],
      },
    ],
    metadata: {
      price: '€10',
      priceLabel: 'per user/month',
    },
  },
  {
    id: 'pro_yearly@1',
    active: true,
    name: 'Professional',
    description: 'For small teams.',
    currency: 'EUR',
    interval: 'year',
    trialDays: 14,
    features: [
      {
        id: 'users',
        label: 'Max 3',
        priceId: 'price_1PLLEuHXr4hWIkAXnykzGvll',
        type: 'per_unit',
        price: 8 * 12,
        limit: 3,
      },
      {
        id: 'inbox',
      },
      {
        id: 'contacts',
      },
      {
        id: 'monthly_active_contacts',
        label: '10000 MACs included',
        priceId: 'price_1POfKwHXr4hWIkAX4VnSn4nT',
        price: 0,
        tiers: [
          {
            upTo: 10000,
            price: 0,
          },
          {
            upTo: 100000,
            price: 0.0001,
          },
          {
            upTo: 'inf',
            price: 0.00005,
          },
        ],
      },
    ],
    metadata: {
      price: '€8',
      priceLabel: 'per user/month',
      discount: '20%',
    },
  },
  {
    id: 'enterprise@1',
    active: true,
    name: 'Enterprise',
    description: 'For growing teams.',
    currency: 'EUR',
    interval: 'month',
    trialDays: 14,
    features: [
      {
        id: 'users',
        priceId: 'price_1PLMLoHXr4hWIkAXJj8iYM5G',
        type: 'per_unit',
        price: 25,
      },
      {
        id: 'inbox',
      },
      {
        id: 'contacts',
      },
      {
        id: 'monthly_active_contacts',
        label: '10000 MACs included',
        priceId: 'price_1POfMAHXr4hWIkAXU2Q43bDZ',
        price: 0,
        tiers: [
          {
            upTo: 10000,
            price: 0,
          },
          {
            upTo: 100000,
            price: 0.0001,
          },
          {
            upTo: 'inf',
            price: 0.00005,
          },
        ],
      },
      {
        id: 'api',
      },
      {
        id: 'support',
        label: 'Priority',
      },
    ],
    metadata: {
      price: '€25',
      priceLabel: 'per user/month',
    },
  },
  {
    id: 'enterprise_yearly@1',
    active: true,
    name: 'Enterprise',
    description: 'For growing teams.',
    currency: 'EUR',
    interval: 'year',
    trialDays: 14,
    features: [
      {
        id: 'users',
        priceId: 'price_1PLMLoHXr4hWIkAXuekAxeP3',
        type: 'per_unit',
        price: 20 * 12,
      },
      {
        id: 'inbox',
      },
      {
        id: 'contacts',
      },
      {
        id: 'monthly_active_contacts',
        label: '10000 MACs included',
        priceId: 'price_1POfMAHXr4hWIkAXU2Q43bDZ',
        price: 0,
        tiers: [
          {
            upTo: 10000,
            price: 0,
          },
          {
            upTo: 100000,
            price: 0.0001,
          },
          {
            upTo: 'inf',
            price: 0.00005,
          },
        ],
      },
      {
        id: 'api',
      },
      {
        id: 'support',
        label: 'Priority',
      },
    ],
    metadata: {
      price: '€20',
      priceLabel: 'per user/month',
      discount: '20%',
    },
  },
]

export const features = [
  {
    id: 'users',
    label: 'Users',
    description: 'The amount of active user accounts.',
  },
  {
    id: 'inbox',
    label: 'Inbox',
    description: 'Send and receive messages.',
  },
  {
    id: 'contacts',
    label: 'Contacts',
    description: 'Manage people and companies.',
  },
  {
    id: 'monthly_active_contacts',
    label: 'Monthly active contacts',
    description: 'The amount of unique contacts you interact with.',
  },
  {
    id: 'api',
    label: 'Api access',
    description: 'Access our API',
  },
  {
    id: 'support',
    label: 'Support',
  },
]
