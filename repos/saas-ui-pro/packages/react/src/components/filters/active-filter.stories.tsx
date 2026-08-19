import * as React from 'react'

import { Badge, BadgeProps, Center } from '@chakra-ui/react'
import { Meta, StoryFn, type StoryObj } from '@storybook/react-vite'
import { FiCircle, FiUser } from 'react-icons/fi'

import {
  ActiveFilter,
  ActiveFilterLabel,
  ActiveFilterOperator,
  ActiveFilterProps,
  ActiveFilterProvider,
  ActiveFilterRemove,
  ActiveFilterRoot,
  ActiveFilterValue,
  FilterItems,
  FilterOperatorId,
  FilterValue,
  useActiveFilter,
} from '.'

export default {
  title: 'Components/Filters/ActiveFilter',
  component: ActiveFilter,
  decorators: [
    (Story: any) => (
      <Center height="100%">
        <Story />
      </Center>
    ),
  ],
} as Meta

type Story = StoryObj<typeof ActiveFilter>

const StatusBadge = (props: BadgeProps) => (
  <Badge
    boxSize="12px"
    padding="0"
    borderRadius="full"
    variant="outline"
    bg="transparent"
    borderWidth="2px"
    borderColor="currentColor"
    boxShadow="none"
    minH="auto"
    p="0"
    {...props}
  />
)

const filters: FilterItems = [
  {
    id: 'status',
    label: 'Status',
    icon: <StatusBadge color="gray.solid" />,
    items: [
      {
        id: 'new',
        label: 'New',
        icon: <StatusBadge color="blue.solid" />,
      },
      {
        id: 'active',
        label: 'Active',
        icon: <StatusBadge color="green.solid" />,
      },
    ],
  },
  {
    id: 'type',
    label: 'Is lead',
    type: 'boolean',
    icon: <FiUser />,
    value: 'lead',
  },
]

const operators = [
  {
    id: 'is',
    label: 'is',
  },
  {
    id: 'isNot',
    label: 'is not',
  },
]

export const Basic = {
  args: {
    ...filters[0],
    defaultValue: 'new',
    operators,
    defaultOperator: 'is',
  },
}

export const WithCallbacks: Story = {
  args: {
    ...filters[0],
    defaultValue: 'new',
    operators,
    defaultOperator: 'is',
    onChange: (filter) => console.log('onChange', filter),
    onOperatorChange: (operator) => console.log('onOperatorChange', operator),
    onValueChange: (value) => console.log('onValueChange', value),
    onRemove: () => console.log('onRemove'),
  },
}

/** @TODO this api is likely to change, ActiveFilterProvider will be moved into Container, to keep the api similar as other components. */
export const Composed = () => {
  const [operator, setOperator] = React.useState<FilterOperatorId>('is')
  const [value, setValue] = React.useState<FilterValue>('new')

  const onReset = () => {
    setOperator('is')
    setValue('new')
  }

  const { filter } = useActiveFilter({
    id: 'composed-filter',
  })

  return (
    <ActiveFilterProvider value={filter}>
      <ActiveFilterRoot>
        <ActiveFilterLabel icon={<StatusBadge color="gray.solid" />}>
          Status
        </ActiveFilterLabel>
        <ActiveFilterOperator
          items={operators}
          value={operator}
          onChange={(val) => setOperator(val)}
        />
        <ActiveFilterValue
          items={filters[0].items}
          value={value}
          onChange={(val) => setValue(val)}
          placeholder="Status"
        />
        <ActiveFilterRemove onClick={onReset} />
      </ActiveFilterRoot>
    </ActiveFilterProvider>
  )
}
