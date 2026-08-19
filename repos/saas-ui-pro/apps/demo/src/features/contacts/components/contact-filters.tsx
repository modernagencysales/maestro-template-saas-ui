import * as React from 'react'

import { Badge, useDisclosure } from '@chakra-ui/react'
import {
  FilterItem,
  FilterMenu,
  FilterMenuProps,
  useFiltersContext,
} from '@saas-ui-pro/react'
import { formatDistanceToNowStrict, startOfDay, subDays } from 'date-fns'
import { LuCalendar, LuFilter, LuTag } from 'react-icons/lu'

import { Tags } from '#api'
import { StatusBadge } from '#components/status-badge'
import { useHotkeysShortcut } from '#features/common/lib/hotkeys'
import { getQueryClient } from '#features/common/lib/react-query'

const days = [1, 2, 3, 7, 14, 21, 31, 60]

export const filters: FilterItem[] = [
  {
    id: 'status',
    label: 'Status',
    icon: <StatusBadge colorPalette="gray" />,
    type: 'enum',
    items: [
      {
        id: 'new',
        label: 'New',
        icon: <StatusBadge colorPalette="blue" />,
      },
      {
        id: 'active',
        label: 'Active',
        icon: <StatusBadge colorPalette="green" />,
      },
      {
        id: 'inactive',
        label: 'Inactive',
        icon: <StatusBadge colorPalette="yellow" />,
      },
    ],
  },
  {
    id: 'tags',
    label: 'Tags',
    icon: <LuTag />,
    type: 'string',
    defaultOperator: 'contains',
    operators: ['contains', 'containsNot'],
    items: () => {
      return (
        getQueryClient()
          .getQueryData<{ tags: Tags }>(['GetTags'])
          ?.tags?.map<FilterItem>((tag) => {
            return {
              id: tag.id,
              label: tag.label,
              icon: <Badge bg={tag.color} boxSize="2" rounded="full" />,
            }
          }) || []
      )
    },
  },
  {
    id: 'createdAt',
    label: 'Created at',
    icon: <LuCalendar />,
    type: 'date',
    operators: ['after', 'before'],
    defaultOperator: 'after',
    items: days
      .map((day): FilterItem => {
        const date = startOfDay(subDays(new Date(), day))
        return {
          id: `${day}days`,
          label: formatDistanceToNowStrict(date, { addSuffix: true }),
          value: date,
        }
      })
      .concat([{ id: 'custom', label: 'Custom' }]),
  },
]

export const AddFilterButton: React.FC<Omit<FilterMenuProps, 'items'>> = (
  props,
) => {
  const disclosure = useDisclosure()

  const filterCommand = useHotkeysShortcut('general.filter', () => {
    disclosure.onOpen()
  })

  const menuRef = React.useRef<HTMLButtonElement>(null)

  const { enableFilter } = useFiltersContext()

  const onSelect = React.useCallback(
    async (item: FilterItem) => {
      const { id, value } = item
      await enableFilter({ id, operator: item.defaultOperator, value })
    },
    [enableFilter],
  )

  return (
    <FilterMenu
      items={filters}
      icon={<LuFilter />}
      ref={menuRef}
      command={filterCommand}
      buttonProps={{ variant: 'ghost', size: 'xs' }}
      onSelect={onSelect}
      open={disclosure.open}
      onOpenChange={({ open }) => {
        if (open) {
          disclosure.onOpen()
        } else {
          disclosure.onClose()
        }
      }}
      {...props}
    />
  )
}
