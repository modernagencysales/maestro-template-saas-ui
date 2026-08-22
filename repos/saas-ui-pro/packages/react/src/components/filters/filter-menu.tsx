'use client'

import * as React from 'react'

import {
  Box,
  Button,
  type ButtonProps,
  HStack,
  Input,
  type MenuRootProps,
  Portal,
  Spinner,
  Text,
  useControllableState,
  useDisclosure,
} from '@chakra-ui/react'
import { useSearchQuery } from '@saas-ui/hooks'
import {
  type Virtualizer,
  type VirtualizerOptions,
  useVirtualizer,
} from '@tanstack/react-virtual'

import { type FilterValue } from '../..'
import { Checkbox } from '../../internal/checkbox'
import { Menu, type MenuContentProps } from '../../internal/menu'
import { splitProps } from '../../utils/split-props'
import type { FilterOperatorId, FilterType } from './operators'
import { useActiveFilterContext } from './use-active-filter'

export interface AsyncFilterItemDetails {
  query?: string
  id: string
  value?: FilterValue
}

export type FilterItems =
  | Array<FilterItem>
  | ((
      details: AsyncFilterItemDetails,
    ) => Array<FilterItem> | Promise<Array<FilterItem>>)

const itemCache = new Map<string, Array<FilterItem>>()

export const useFilterItems = ({
  id,
  value,
  items,
  inputValue,
}: {
  id: string
  value?: FilterValue
  items: FilterItems
  inputValue?: string
}) => {
  const [data, setData] = React.useState<Array<FilterItem>>(
    itemCache.get(id) || [],
  )
  const [isLoading, setLoading] = React.useState(false)
  const [isFetched, setFetched] = React.useState(false)

  const getItems = React.useCallback(
    async (inputValue = '') => {
      if (typeof items === 'function') {
        setLoading(true)
        const result = await items({
          query: inputValue,
          id,
          value,
        })
        setLoading(false)
        setFetched(true)
        return result
      }
      return items
    },
    [items, id, value],
  )

  React.useEffect(() => {
    if (typeof items !== 'function') {
      return
    }

    const cacheItems = itemCache.get(id)

    // if there are cached items, we set them immediately
    // and refetch them to get fresh data
    if (cacheItems) {
      setFetched(true)
      setData(cacheItems)
    }

    getItems(inputValue).then((data) => {
      setData(data)

      const mergedData = [...(cacheItems || []), ...data].reduce(
        (acc, item) => {
          const exists = acc.some((existing) => existing.id === item.id)
          if (!exists) {
            acc.push(item)
          }
          return acc
        },
        [] as Array<FilterItem>,
      )

      itemCache.set(id, mergedData)
    })
  }, [id, items, getItems, inputValue])

  if (typeof items !== 'function') {
    return { data: items, isLoading: false, isFetched: true }
  }

  return { data, isLoading, isFetched }
}

export interface FilterItem {
  /**
   * The filter id
   */
  id: string
  /**
   * The filter label
   *
   * e.g. "Contact is lead"
   */
  label?: string
  /**
   * The active filter label
   *
   * e.g. "Contact"
   */
  activeLabel?: string
  /**
   * Icon displayed before the label
   */
  icon?: React.ReactElement
  /**
   * The filter type
   */
  type?: FilterType
  /**
   * The available
   */
  items?: FilterItems
  /**
   * Enable multiple select if true
   */
  multiple?: boolean
  /**
   * The filter value
   */
  value?: string | string[] | number | boolean | Date
  /**
   * The available operators
   */
  operators?: FilterOperatorId[]
  /**
   * The default operator
   */
  defaultOperator?: FilterOperatorId
  /**
   * Disable the item
   */
  disabled?: boolean
}

export interface FilterMenuProps
  extends Omit<MenuRootProps, 'children' | 'onChange' | 'onSelect'> {
  value?: FilterValue
  items: FilterItems
  icon?: React.ReactNode
  label?: React.ReactNode
  placeholder?: string
  command?: string
  multiple?: boolean
  onSelect?(item: FilterItem | FilterItem[]): void
  onChange?(value?: FilterValue): void
  buttonProps?: ButtonProps
  menuProps?: MenuContentProps
  inputValue?: string
  inputDefaultValue?: string
  onInputChange?(value: string, activeItemId?: string): void
  onInputCommitValue?: ({
    value,
    activeItem,
  }: {
    value: string
    activeItem: FilterItem | null
  }) => void
  virtualizer?: Partial<VirtualizerOptions<HTMLDivElement, Element>>
  portalled?: boolean
}

export const FilterMenu = React.forwardRef<HTMLButtonElement, FilterMenuProps>(
  function FilterMenu(props, forwardedRef) {
    const {
      items,
      label = 'Filter',
      placeholder = 'Filter...',
      command,
      icon,
      buttonProps,
      menuProps,
      onSelect,
      value: valueProp,
      onChange: onChangeProp,
      open: openProp,
      defaultOpen,
      onOpenChange: onOpenChangeProp,
      onInputCommitValue,
      inputValue,
      inputDefaultValue,
      onInputChange,
      multiple,
      closeOnSelect,
      virtualizer: virtualizerOptions,
      portalled,
      ...rest
    } = props

    const listRef = React.useRef<HTMLDivElement>(null)

    const [value, setValue] = useControllableState<FilterValue | undefined>({
      value: valueProp,
      onChange: (value) => {
        onChangeProp?.(value)

        if (!open || !value) {
          return
        }

        // if there is an activeItem we select the value
        if (activeItemRef.current) {
          onSelect?.({
            ...activeItemRef.current,
            value,
          })
          return
        }

        let id: string | null = null
        if (Array.isArray(value)) {
          // we always pick the first value here to retrieve the filter
          // this should be no problem because we only support one filter here.
          id = value[0]
        } else if (typeof value === 'string') {
          id = value
        }

        const filter = results?.find(
          (filter) =>
            filter.id === id || filter.value === id || filter.value === value,
        )

        if (filter) {
          onSelect?.(filter)
        }
      },
    })

    const onCheck = React.useCallback(
      (idOrValue: NonNullable<FilterValue>, isChecked: boolean) => {
        setValue((value) => {
          let values: string[] = []
          if (typeof value === 'string') {
            values = [value]
          } else if (Array.isArray(value)) {
            values = value.concat()
          }

          if (isChecked && values.indexOf(idOrValue as string) === -1) {
            values.push(idOrValue as string)
          } else if (!isChecked) {
            values = values.filter((value) => value !== idOrValue)
          }

          return values
        })
      },
      [setValue],
    )

    const isChecked = (idOrValue: NonNullable<FilterValue>) => {
      return Array.isArray(value) && value?.includes(idOrValue as string)
    }

    const { open, onOpen, onClose } = useDisclosure({
      open: openProp,
      defaultOpen,
      onOpen() {
        onOpenChangeProp?.({ open: true })

        if (!open) {
          setActiveItem(null)

          // if the value is empty we need to reset it
          if (!props.value) {
            setValue(undefined)
          }
        }

        filterRef.current?.focus()
      },
      onClose() {
        onReset()
        onOpenChangeProp?.({ open: false })
      },
    })

    const filterRef = React.useRef<HTMLInputElement>(null)

    const [activeItem, _setActiveItem] = React.useState<FilterItem | null>(null)
    const activeItemRef = React.useRef<FilterItem | null>(null)

    const setActiveItem = (item: FilterItem | null) => {
      activeItemRef.current = item || null
      _setActiveItem(item)
    }

    const [filterValue, setFilterValue] = React.useState(inputValue || '')

    const activeFilterContext = useActiveFilterContext()

    const { data, isLoading, isFetched } = useFilterItems({
      id: activeItem?.id ?? activeFilterContext?.id ?? 'default',
      items: activeItem?.items || items,
      value,
      inputValue: filterValue,
    })

    const { results, onReset, ...inputProps } = useSearchQuery<FilterItem>({
      items: isLoading && !isFetched ? [] : data,
      fields: ['id', 'label'],
      value: inputValue,
      defaultValue: inputDefaultValue,
      onChange: (value) => {
        onInputChange?.(value, activeItem?.id)
        setFilterValue(value)
      },
    })

    const spinner = isLoading ? (
      <Spinner size="sm" position="absolute" top="3" right="3" />
    ) : null

    const onItemClick = React.useCallback(
      async (item: FilterItem, close = true) => {
        const count = item.items?.length || 0

        if (count > 1 || typeof item.items === 'function') {
          setActiveItem(item)
          onReset()
          filterRef.current?.focus()
          return
        } else if (count === 1) {
          setActiveItem(item)
          const value = item.items?.[0].value || item.items?.[0].id
          setValue(value)
        } else {
          const itemValue = (item.value || item.id) as string
          const isMulti = multiple || item.multiple || activeItem?.multiple

          const values = Array.isArray(value) ? value : ([] as string[])

          isMulti
            ? onCheck(itemValue as string, !values.includes(itemValue))
            : setValue(itemValue)
        }

        if (close) {
          onClose()
        }
      },
      [onReset, onClose, onSelect, activeItem, value, onCheck],
    )

    const virtualizer = useVirtualizer({
      count: results?.length || 0,
      estimateSize: () => 32,
      getScrollElement: () => {
        return listRef.current
      },
      ...virtualizerOptions,
    })

    const shouldVirtualize = virtualizerOptions?.enabled || data?.length > 20

    const renderItems = shouldVirtualize
      ? virtualizer.getVirtualItems()
      : results

    const virtualPadding = useVirtualizerPadding(
      shouldVirtualize ? virtualizer : null,
    )

    const isMulti = multiple || activeItem?.multiple

    return (
      <Menu.Root
        open={open}
        onOpenChange={({ open }) => (open ? onOpen() : onClose())}
        closeOnSelect={closeOnSelect ?? false}
        {...rest}
      >
        <Menu.Trigger asChild>
          <Button ref={forwardedRef} {...buttonProps}>
            {icon} {label}
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Content
            ref={listRef}
            zIndex="dropdown"
            pt="0"
            overflow="auto"
            {...menuProps}
          >
            <Box
              borderBottomWidth="1px"
              borderColor="border.subtle"
              mx="-2"
              mb="1"
              py="0.5"
            >
              <Input
                ref={filterRef}
                border="0"
                borderRadius="0"
                placeholder={activeItem?.label || placeholder}
                value={inputProps.value}
                onChange={(e) => {
                  inputProps.onChange(e.target.value)
                }}
              />
            </Box>
            <Menu.ItemGroup>
              {spinner}

              {virtualPadding?.top ? (
                <div style={{ height: `${virtualPadding.top}px` }} />
              ) : null}

              {results?.map((item, i) => {
                const [filterProps, itemProps] = splitProps(item, [
                  'id',
                  'label',
                  'activeLabel',
                  'type',
                  'items',
                  'value',
                  'operators',
                  'defaultOperator',
                  'multiple',
                  'icon',
                ])

                const { id, icon } = filterProps

                const _icon = isMulti ? (
                  <HStack>
                    <Checkbox
                      checked={isChecked(id)}
                      onCheckedChange={(e) => onCheck(id, !!e.checked)}
                    />
                    {icon}
                  </HStack>
                ) : (
                  icon
                )

                return (
                  <Menu.Item
                    key={`${item.id}-${i}`}
                    value={item.id}
                    {...itemProps}
                    onClick={(e) => {
                      if ((e.target as any).closest('[data-scope=checkbox]')) {
                        e.stopPropagation()
                        return
                      }
                      onItemClick(item)
                    }}
                  >
                    {_icon}
                    <Text>{item.label}</Text>
                  </Menu.Item>
                )
              })}
              {/* {renderItems.map((itemOrVirtualItem) => {
              const item =
                'index' in itemOrVirtualItem
                  ? filteredItems[itemOrVirtualItem.index]
                  : itemOrVirtualItem

              return <React.Fragment key={item.key}>{item}</React.Fragment>
            })} */}

              {virtualPadding?.bottom ? (
                <div style={{ height: `${virtualPadding.bottom}px` }} />
              ) : null}
            </Menu.ItemGroup>
          </Menu.Content>
        </Portal>
      </Menu.Root>
    )
  },
)

export function useVirtualizerPadding(
  virtualizer?: Virtualizer<HTMLDivElement, Element> | null,
) {
  const virtualItems = virtualizer?.getVirtualItems()

  let top: number = 0
  let bottom: number = 0

  if (virtualizer && virtualItems?.length) {
    const totalSize = virtualizer?.getTotalSize()

    top = virtualItems.length > 0 ? virtualItems?.[0]?.start || 0 : 0
    bottom =
      virtualItems.length > 0
        ? totalSize - (virtualItems?.[virtualItems.length - 1]?.end || 0)
        : 0
  }

  return {
    top,
    bottom,
  }
}
