import React from 'react'

import { Button, Container, Stack, Text } from '@chakra-ui/react'
import { Meta, StoryObj } from '@storybook/react-vite'

import { FeaturesProvider, FeaturesProviderProps, useFeatures } from '..'

const meta: Meta = {
  title: 'Components/FeatureFlags/FeaturesProvider',
  parameters: {
    controls: { expanded: true },
  },
  args: {},
  decorators: [
    (Story, context) => {
      return (
        <FeaturesProvider value={context.args.value}>
          <Container>
            <Story />
          </Container>
        </FeaturesProvider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<FeaturesProviderProps>

export const Roles: Story = {
  render: () => {
    const features = useFeatures()

    const user = React.useMemo(
      () => ({
        role: 'admin',
      }),
      [],
    )

    React.useEffect(() => {
      if (features.isReady) {
        features.identify(user)
      }
    }, [features.isReady, user])

    return (
      <Stack>
        <Text>Role: {user.role}</Text>
        <Text>Features: {Object.keys(features.flags).join(', ')}</Text>
      </Stack>
    )
  },
  args: {
    value: {
      segments: [
        {
          id: 'admin',
          attr: [
            {
              key: 'role',
              value: 'admin',
            },
          ],
          features: ['settings'],
        },
      ],
    },
  },
}

export const FeatureValue: Story = {
  render: () => {
    const features = useFeatures()

    const user = React.useMemo(
      () => ({
        role: 'admin',
      }),
      [],
    )

    React.useEffect(() => {
      if (features.isReady) {
        features.identify(user)
      }
    }, [features.isReady, user])

    return (
      <Stack>
        {Object.keys(features.flags).map((key) => (
          <Text key={key}>
            {key}: {features.flags[key]?.toString()}
          </Text>
        ))}
      </Stack>
    )
  },
  args: {
    value: {
      segments: [
        {
          id: 'admin',
          attr: [
            {
              key: 'role',
              value: 'admin',
            },
          ],
          features: [
            { id: 'settings', value: 'enabled' },
            { id: 'manage-users', value: true },
          ],
        },
      ],
    },
  },
}

export const UpgradePlan: Story = {
  render: () => {
    const features = useFeatures()

    const [plan, setPlan] = React.useState('basic')

    const user = React.useMemo(() => {
      return {
        id: 1,
        role: 'admin',
        plan,
      }
    }, [plan])

    const upgrade = () => {
      setPlan('pro')
    }

    const downgrade = () => {
      setPlan('basic')
    }

    React.useEffect(() => {
      if (features.isReady) {
        features.identify(user)
      }
    }, [features.isReady, user])

    return (
      <Stack>
        {plan === 'pro' ? (
          <Button onClick={downgrade}>Downgrade</Button>
        ) : (
          <Button onClick={upgrade}>Upgrade</Button>
        )}

        <Text>Features: {Object.keys(features.flags).join(', ')}</Text>
      </Stack>
    )
  },
  args: {
    value: {
      segments: [
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
    },
  },
}

export const MultipleSegments: Story = {
  render: () => {
    const features = useFeatures()

    const [plan, setPlan] = React.useState('basic')

    const user = React.useMemo(() => {
      return {
        id: 1,
        role: 'admin',
        plan,
      }
    }, [plan])

    const upgrade = () => {
      setPlan('pro')
    }

    const downgrade = () => {
      setPlan('basic')
    }

    React.useEffect(() => {
      if (features.isReady) {
        features.identify(user)
      }
    }, [features.isReady, user])

    return (
      <Stack>
        {plan === 'pro' ? (
          <Button onClick={downgrade}>Downgrade</Button>
        ) : (
          <Button onClick={upgrade}>Upgrade</Button>
        )}

        <Text>Features: {Object.keys(features.flags).join(', ')}</Text>
      </Stack>
    )
  },
  args: {
    value: {
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
    },
  },
}

export const MultiplePlans: Story = {
  render: () => {
    const features = useFeatures()

    const [plan, setPlan] = React.useState('free')

    const user = React.useMemo(() => {
      return {
        id: 1,
        role: 'admin',
        plan,
      }
    }, [plan])

    const upgrade = () => {
      setPlan('pro')
    }

    const downgrade = () => {
      setPlan('free')
    }

    React.useEffect(() => {
      if (features.isReady) {
        features.identify(user)
      }
    }, [features.isReady, user])

    return (
      <Stack>
        {plan === 'pro' ? (
          <Button onClick={downgrade}>Downgrade</Button>
        ) : (
          <Button onClick={upgrade}>Upgrade</Button>
        )}

        <Text>Features: {Object.keys(features.flags).join(', ')}</Text>
      </Stack>
    )
  },
  args: {
    value: {
      segments: [
        {
          id: 'admin',
          attr: [
            {
              key: 'role',
              value: 'admin',
            },
          ],
          features: ['settings'],
        },
        {
          id: 'freePlan',
          attr: [
            {
              key: 'plan',
              value: 'free',
            },
          ],
          features: ['free-feature'],
        },
        {
          id: 'proPlan',
          attr: [
            {
              key: 'plan',
              value: 'pro',
            },
          ],
          features: ['free-feature', 'paid-feature'],
        },
      ],
    },
  },
}
