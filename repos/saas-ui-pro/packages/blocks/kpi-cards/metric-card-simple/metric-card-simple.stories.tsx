import * as React from 'react'

import { HStack } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { MetricCard } from './metric-card-simple'

export default {
  title: 'Blocks/KPI Cards/MetricCardSimple',
  decorators: [(Story) => <Story />],
} as Meta

const metrics = [
  {
    id: 'active-users',
    label: 'Active users',
    value: '676',
    difference: '12.4%',
    isPositive: true,
  },
  {
    id: 'revenue',
    label: 'Revenue',
    value: '$ 29,294',
    difference: '21%',
    isPositive: false,
  },
  {
    id: 'avg-click-rate',
    label: 'Avg. click rate',
    value: '14%',
    difference: '5%',
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
