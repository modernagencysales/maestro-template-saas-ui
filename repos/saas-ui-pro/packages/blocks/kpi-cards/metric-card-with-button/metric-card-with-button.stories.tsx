import * as React from 'react'

import { HStack } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { MetricCard } from './metric-card-with-button'

export default {
  title: 'Blocks/KPI Cards/MetricCardWithButton',
  decorators: [(Story) => <Story />],
} as Meta

const metrics = [
  {
    id: 'active-users',
    label: 'Active users',
    value: '1,294',
    difference: '12.4%',
    isPositive: true,
  },
  {
    id: 'sales',
    label: 'Sales',
    value: '$ 28,294',
    difference: '4%',
    isPositive: false,
  },
  {
    id: 'avg-click-rate',
    label: 'Avg. click rate',
    value: '1,294',
    difference: '12.4%',
    isPositive: true,
  },
]

export const Default = () => (
  <HStack p="8">
    {metrics.map((metric) => (
      <MetricCard key={metric.label} {...metric} />
    ))}
  </HStack>
)
