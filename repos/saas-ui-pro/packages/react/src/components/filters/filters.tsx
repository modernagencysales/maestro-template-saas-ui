import React, { forwardRef } from 'react'

import { FilterIcon } from '../../icons'
import { FilterItem, FilterMenu, FilterMenuProps } from './filter-menu'
import { useFiltersContext } from './provider'

export const FiltersAddButton = forwardRef<
  HTMLButtonElement,
  Omit<FilterMenuProps, 'items'>
>((props, ref) => {
  const { onOpenChange: onOpenChangeProp, open, ...rest } = props
  const { filters, enableFilter } = useFiltersContext()

  const openRef = React.useRef(false)
  const [currentKey, setCurrentKey] = React.useState<string | undefined>()

  const onSelect = async (item: FilterItem) => {
    const { id, value } = item

    // if the filter value changes while the menu is open, we update the filter instead.
    const key = await enableFilter(
      currentKey ? { key: currentKey, id, value } : { id, value },
    )

    if (openRef.current) {
      // only set this if the menu is still open
      setCurrentKey(key)
    }
  }

  const onOpenChange = (details: { open: boolean }) => {
    setCurrentKey(undefined)
    onOpenChangeProp?.(details)
    openRef.current = details.open
  }

  return (
    <FilterMenu
      items={filters || []}
      icon={<FilterIcon />}
      ref={ref}
      onSelect={onSelect}
      onOpenChange={onOpenChange}
      open={open}
      {...rest}
    />
  )
})
