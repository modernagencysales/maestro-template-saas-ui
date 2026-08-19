'use client'

import * as React from 'react'

import {
  type UseControllableStateProps,
  createContext,
  useControllableState,
} from '@chakra-ui/react'
import { format, formatDistanceToNowStrict, isAfter } from 'date-fns'

import { callAll } from '../../utils/dom'
import {
  type FilterItem,
  type FilterItems,
  type FilterMenuProps,
  useFilterItems,
} from './filter-menu'
import type { FilterOperatorId, FilterOperators } from './operators'

export interface Filter {
  key?: string
  id: string
  value?: FilterValue
  operator?: FilterOperatorId
}

export type FilterValue = string | string[] | number | boolean | Date | null

export interface ActiveFilterContextValue {
  id: string
  label?: string
  operators?: FilterOperators
  operator?: FilterOperatorId
  value?: FilterValue
  items?: FilterItems
  onValueChange?(value: FilterValue): void
}

export const [ActiveFilterProvider, useActiveFilterContext] =
  createContext<ActiveFilterContextValue>({
    name: 'ActiveFilterContext',
    strict: false,
  })

export interface ActiveFilterValueOptions {
  items?: FilterItems
  value?: FilterValue
  onChange?(value: FilterValue): void
  defaultValue?: FilterValue
  placeholder?: string
  multiple?: boolean
  format?(value: FilterValue): string
  children?: React.ReactNode
}

export interface UseActiveFilterProps {
  id: string
  value?: FilterValue
  defaultValue?: FilterValue
  operator?: FilterOperatorId
  defaultOperator?: FilterOperatorId
  onChange?(filter: Filter): void
  onOperatorChange?(operator: FilterOperatorId): void
  onValueChange?(value: FilterValue): void
}

export const useActiveFilter = (props: UseActiveFilterProps) => {
  const {
    id,
    defaultValue,
    defaultOperator,
    onChange,
    onOperatorChange: onOperatorChangeProp,
    onValueChange: onValueChangeProp,
  } = props

  const [filter, setFilter] = useControllableState<Filter>({
    defaultValue: {
      id,
      value: defaultValue,
      operator: defaultOperator ?? 'is',
    },
    onChange,
  })

  const onOperatorChange = (operator: FilterOperatorId) => {
    setFilter({
      ...filter,
      operator,
    })
  }

  const onValueChange = (value: FilterValue) => {
    setFilter({
      ...filter,
      value,
    })
  }

  return {
    filter,
    onOperatorChange: callAll(onOperatorChange, onOperatorChangeProp),
    onValueChange: callAll(onValueChange, onValueChangeProp),
  }
}

export interface UseFilterOperatorProps
  extends UseControllableStateProps<FilterOperatorId> {
  items?: FilterItem[]
}

export const useFilterOperator = (props: UseFilterOperatorProps) => {
  const {
    items,
    defaultValue,
    value: valueProp,
    onChange: onChangeProp,
  } = props

  const [value, setValue] = useControllableState<FilterOperatorId>({
    defaultValue: defaultValue || 'is',
    value: valueProp,
    onChange: onChangeProp,
  })

  const item = React.useMemo(
    () => items?.find(({ id }) => id === value),
    [items, value],
  )

  const getItemProps = React.useCallback(
    (item: FilterItem) => {
      return {
        onClick: () => setValue(item.id as FilterOperatorId),
      }
    },
    [setValue],
  )

  return {
    value,
    label: item?.label || value,
    getItemProps,
  }
}

const defaultFormatter = (value: FilterValue) => {
  if (value instanceof Date) {
    if (isAfter(value, new Date())) {
      return format(value, 'PP')
    }
    return formatDistanceToNowStrict(value, { addSuffix: true })
  }

  return value?.toString()
}

export interface UseFilterValueProps extends ActiveFilterValueOptions {}

export const useFilterValue = (props: UseFilterValueProps = {}) => {
  const filter = useActiveFilterContext()

  const {
    onChange: onChangeProp,
    value: valueProp,
    defaultValue,
    format,
    items: itemsProp,
    multiple,
    children,
  } = props

  const [value, setValue] = useControllableState<FilterValue>({
    defaultValue: defaultValue || '',
    value: valueProp,
    onChange: (value) => {
      onChangeProp?.(value)
    },
  })

  const {
    data: items,
    isLoading,
    isFetched,
  } = useFilterItems({
    id: filter.id,
    value,
    items: React.useMemo(() => props.items || [], [props.items]),
  })

  const item = items?.find((item) => item.id === value || item.value === value)

  const onChange = React.useCallback(
    async (value?: string | string[]) => {
      setValue(value as FilterValue)
    },
    [value, setValue],
  )

  let label = format?.(value) || item?.label || defaultFormatter(value)

  if (multiple && Array.isArray(value)) {
    label = items
      ?.filter(
        (filter) =>
          value?.includes(filter.id) || value?.includes(filter.value as string),
      )
      .map(({ label }) => label)
      .join(', ')
  }

  const getMenuProps = React.useCallback((): FilterMenuProps => {
    return {
      value,
      items: itemsProp || items,
      label: children || label,
      placeholder: filter.label,
      icon: item?.icon,
      multiple,
      onChange,
    }
  }, [filter, value, label, item, itemsProp, multiple, onChange])

  return {
    item,
    value,
    label,
    getMenuProps,
    isLoading,
    isFetched,
  }
}
