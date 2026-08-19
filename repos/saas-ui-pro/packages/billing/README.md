# Saas UI Pro - Billing Provider

A React context provider for managing subscription plans, billing status, and trial periods in your SaaS application. Provides hooks and utilities to easily access billing information throughout your app, handle trial states, and manage subscription features.

## Installation

```bash
npm install @saas-ui-pro/billing
```

## Usage

Add the `BillingProvider` to your app.

```tsx
import { BillingProvider } from "@saas-ui-pro/billing";

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 10,
  },
]

export default function Provider(props: { children: React.ReactNode }) {
  const billing = React.useMemo(() => {
    // Data fetched from the server
    return {
      plans: plans,
      status: 'active'
      planId: 'free',
      startedAt: new Date(),
      trialEndsAt: new Date(),
    }
  }, [])

  return (
    <BillingProvider value={billing}>
      {props.children}
    </BillingProvider>
  )
}
```

Use the billing context in your components.

```tsx
import { useBilling, useIsTrialing } from '@saas-ui-pro/billing'

export default function Page() {
  const { billing } = useBilling()

  const isTrialing = useIsTrialing()

  return (
    <div>
      <h1>Billing</h1>
      <p>{billing.status}</p>
      <p>{isTrialing ? 'Trialing' : 'Not trialing'}</p>
    </div>
  )
}
```

## License

This package is free for personal use. For commercial use, see [Saas UI Pro License](https://saas-ui.dev/license).

Source code is available for Saas UI Pro customers.
