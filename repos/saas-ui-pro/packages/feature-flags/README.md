# Saas UI Pro - Feature Flags

A React context provider for managing feature flags in your SaaS application. Provides hooks and utilities to easily access feature flags throughout your app, handle feature flag states, and manage feature flag features.

## Installation

```bash
npm install @saas-ui-pro/feature-flags
```

## Usage

```tsx
import { FeaturesOptions, FeaturesProvider } from '@saas-ui-pro/feature-flags'

const options: FeaturesOptions = {
  segments: [
    {
      id: 'admin',
      attr: [
        {
          key: 'role',
          value: 'admin',
        },
      ],
      features: ['settings', { id: 'value-feature', value: 'enabled' }],
    },
    {
      id: 'proPlan',
      attr: [
        {
          key: 'plan',
          value: 'pro',
        },
      ],
      features: ['inbox'],
    },
  ],
}

export default function App({ children }) {
  return <FeaturesProvider value={options}>{chilren}</FeaturesProvider>
}
```

Identify the user in the feature flags context.

```tsx
import { useFeatures } from '@saas-ui-pro/feature-flags'
import { useAuth } from '@saas-ui/auth'

export default function Layout({ children }) {
  const features = useFeatures()

  const user = {
    id: 1,
    plan: 'pro',
    role: 'admin',
  }

  React.useEffect(() => {
    if (features.isReady && user) {
      features.identify(user)
    }
  }, [features.isReady, user])

  return <>{children}</>
}
```

### Has component

`Has` component to check if a feature is enabled.

```tsx
import { Has } from '@saas-ui-pro/feature-flags'

export default function Page() {
  return (
    <Has feature="settings">
      <p>Settings are enabled</p>
    </Has>
  )
}
```

`Has` component with multiple features.

```tsx
import { Has } from '@saas-ui-pro/feature-flags'

export default function Page() {
  return (
    <Has features={['settings', 'inbox']}>
      <p>Settings and inbox are enabled</p>
    </Has>
  )
}
```

`Has` component with a feature flag value.

```tsx
import { Has } from '@saas-ui-pro/feature-flags'

export default function Page() {
  return (
    <Has feature="settings" value="enabled">
      <p>Settings are enabled</p>
    </Has>
  )
}
```

### useFlag hook

`useFlag` hook to check if a feature is enabled.

```tsx
import { useFlag } from '@saas-ui-pro/feature-flags'

const value = useFlag('settings')
```

### useHasFeature hook

`useHasFeature` hook to check if a feature is enabled.

```tsx
import { useHasFeature } from '@saas-ui-pro/feature-flags'

const hasFeature = useHasFeature('settings')
```

## License

This package is free for personal use. For commercial use, see [Saas UI Pro License](https://saas-ui.dev/license).

Source code is available for Saas UI Pro customers.
