import * as React from 'react'

import { Badge, BadgeProps, Center } from '@chakra-ui/react'
import { Meta, StoryObj } from '@storybook/react-vite'
import { FiCircle, FiUser } from 'react-icons/fi'

import { FilterItem, FilterMenu, FilterMenuProps } from '.'

export default {
  title: 'Components/Filters/FilterMenu',
  component: FilterMenu,
  decorators: [
    (Story: any) => (
      <Center height="100%">
        <Story />
      </Center>
    ),
  ],
} as Meta

const StatusBadge = (props: BadgeProps) => (
  <Badge
    boxSize="8px"
    minH="auto"
    mx="2px"
    p="0"
    borderRadius="full"
    {...props}
  />
)

const filters: FilterItem[] = [
  {
    id: 'status',
    label: 'New users',
    icon: <StatusBadge bg="blue.400" />,
    value: 'new',
  },
  {
    id: 'status',
    label: 'Active users',
    icon: <StatusBadge bg="green.400" />,
    value: 'active',
  },
  {
    id: 'type',
    label: 'Contact is lead',
    activeLabel: 'Contact',
    icon: <FiUser />,
    value: 'lead',
  },
]

const filtersNested: FilterItem[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'enum',
    icon: <FiCircle />,
    items: [
      {
        id: 'new',
        label: 'New',
        icon: <StatusBadge bg="blue.400" />,
      },
      {
        id: 'active',
        label: 'Active',
        icon: <StatusBadge bg="green.400" />,
      },
    ],
  },
  {
    id: 'type',
    label: 'Contact is lead',
    activeLabel: 'Contact',
    icon: <FiUser />,
    value: 'lead',
  },
]

export const Basic = {
  args: {
    items: filters,
    defaultIsOpen: true,
  },
}

export const NestedFilters = {
  args: {
    items: filtersNested,
  },
}

const filtersAsync: FilterItem[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'enum',
    icon: <FiCircle />,
    items: async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve([
            {
              id: 'new',
              label: 'New',
              icon: <StatusBadge bg="blue.400" />,
            },
            {
              id: 'active',
              label: 'Active',
              icon: <StatusBadge bg="green.400" />,
            },
          ])
        }, 1000)
      })
    },
  },
  {
    id: 'lead',
    label: 'Contact is lead',
    activeLabel: 'Contact',
    icon: <FiUser />,
    value: 'lead',
  },
]

export const WithAsyncFilters = () => {
  const [items, setItems] = React.useState<FilterItem[]>(filtersAsync)
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const onChange = (value: string, activeItemId: string) => {
    // only search root items
    if (activeItemId) {
      return
    }

    setQuery(value)

    // this simulates a fetch from the backend.
    setLoading(true)
    setTimeout(() => {
      setItems(
        filtersAsync.filter((filter) => {
          return filter.id.match(value)
        }),
      )
      setLoading(false)
    }, 1000)
  }

  return (
    <FilterMenu
      items={items}
      inputValue={query}
      onInputChange={onChange}
      buttonProps={{ loading }}
    />
  )
}
