import { Card, Container, DataList } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { FeaturesProvider, useFlag } from '..'
import options from './config'

const meta: Meta = {
  title: 'Components/FeatureFlags/useFlag',
  component: FeaturesProvider,
  parameters: {
    controls: { expanded: true },
  },
  args: {},
  decorators: [
    (Story) => {
      return (
        <Container>
          <FeaturesProvider
            value={{
              ...options,
              attr: {
                role: 'admin',
              },
            }}
          >
            <Story />
          </FeaturesProvider>
        </Container>
      )
    },
  ],
}
export default meta

export const Default = () => {
  return (
    <Card.Root px="4">
      <DataList.Root>
        <FlagProperty label="settings" value={useFlag('settings')} />
        <FlagProperty label="beta" value={useFlag('beta')} />
        <FlagProperty
          label="enterprise-feature"
          value={useFlag('enterprise-feature')}
        />
        <FlagProperty label="value-feature" value={useFlag('value-feature')} />
      </DataList.Root>
    </Card.Root>
  )
}

function FlagProperty(props: { label: string; value: unknown }) {
  return (
    <DataList.Item>
      <DataList.ItemLabel>{props.label}</DataList.ItemLabel>
      <DataList.ItemValue>{String(props.value)}</DataList.ItemValue>
    </DataList.Item>
  )
}
