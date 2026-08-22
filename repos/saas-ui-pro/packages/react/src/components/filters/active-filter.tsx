'use client'

import * as React from 'react'

import {
  Box,
  Button,
  type ButtonProps,
  Flex,
  type FlexProps,
  Group,
  type GroupProps,
  HTMLChakraProps,
  IconButton,
  Input,
  InputProps,
  type MenuContentProps,
  type MenuRootProps,
  type MenuTriggerProps,
  Portal,
  PortalProps,
  type SlotRecipeProps,
  SystemStyleObject,
  chakra,
  createSlotRecipeContext,
  useRecipe,
  useSlotRecipe,
} from '@chakra-ui/react'

import { XIcon } from '../../icons'
import { Menu } from '../../internal/menu'
import { cx } from '../../utils/dom'
import { createSplitProps, splitProps } from '../../utils/split-props'
import {
  type ActiveFilterVariantProps,
  activeFilterSlotRecipe,
} from './active-filter.recipe.ts'
import { FilterItem, FilterItems, FilterMenu } from './filter-menu'
import { FilterOperatorId, FilterType } from './operators'
import { useFiltersContext } from './provider'
import {
  ActiveFilterContextValue,
  ActiveFilterProvider,
  ActiveFilterValueOptions,
  Filter,
  FilterValue,
  UseFilterOperatorProps,
  useActiveFilter,
  useActiveFilterContext,
  useFilterOperator,
  useFilterValue,
} from './use-active-filter'

export type FilterRenderFn = (
  context: ActiveFilterContextValue,
) => React.ReactNode

const {
  StylesProvider,
  ClassNamesProvider,
  useStyles,
  withProvider,
  withContext,
} = createSlotRecipeContext({
  key: 'activeFilter',
})

export interface ActiveFilterOptions {
  id: string
  icon?: React.ReactNode
  label?: string
  value?: FilterValue
  defaultValue?: FilterValue
  items?: FilterItems
  operators?: FilterItem[]
  operator?: FilterOperatorId
  defaultOperator?: FilterOperatorId
  type?: FilterType
  onRemove?(): void
  onChange?(filter: Filter): void
  onOperatorChange?(id: FilterOperatorId): void
  onValueChange?(value: FilterValue): void
  /**
   * Custom label formatter
   */
  formatLabel?(label?: string): string
  /**
   * Format the value of the filter, eg timestamps, numbers, etc.
   */
  formatValue?(value: FilterValue): string
  /**
   * Render the value of the filter, can render custom components like inputs.
   * Return `undefined` to use the default value rendering
   */
  renderValue?: FilterRenderFn
  /**
   * Enable multiple select
   */
  multiple?: boolean
}

export interface ActiveFilterProps
  extends Omit<ActiveFilterRootProps, 'id' | 'onChange' | 'defaultValue'>,
    ActiveFilterOptions {}

const splitActiveFilterProps = createSplitProps<ActiveFilterOptions>([
  'defaultOperator',
  'defaultValue',
  'formatLabel',
  'formatValue',
  'icon',
  'id',
  'items',
  'label',
  'multiple',
  'onChange',
  'onOperatorChange',
  'onRemove',
  'onValueChange',
  'operator',
  'operators',
  'renderValue',
  'type',
  'value',
])

export const ActiveFilter: React.FC<ActiveFilterProps> = (props) => {
  const [filterProps, containerProps] = splitActiveFilterProps(props)

  const {
    icon,
    label,
    value,
    defaultValue,
    items,
    operators,
    operator,
    defaultOperator,
    onRemove,
    formatLabel,
    formatValue,
    renderValue,
    multiple,
  } = filterProps

  const { filter, onOperatorChange, onValueChange } =
    useActiveFilter(filterProps)

  const context: ActiveFilterContextValue = {
    ...filter,
    items,
    value: defaultValue || value,
    label,
    onValueChange,
  }

  return (
    <ActiveFilterProvider value={context}>
      <ActiveFilterRoot {...containerProps}>
        <ActiveFilterLabel icon={icon}>
          {formatLabel?.(label) || label}
        </ActiveFilterLabel>
        <ActiveFilterOperator
          items={operators}
          value={operator}
          defaultValue={defaultOperator}
          onChange={onOperatorChange}
        />
        <ActiveFilterValue
          items={items}
          value={value}
          defaultValue={defaultValue}
          onChange={onValueChange}
          multiple={multiple}
          format={formatValue}
        >
          {renderValue?.(context)}
        </ActiveFilterValue>
        <ActiveFilterRemove
          onClick={onRemove}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onRemove?.()
            }
          }}
        />
      </ActiveFilterRoot>
    </ActiveFilterProvider>
  )
}

ActiveFilter.displayName = 'ActiveFilter'

export const ActiveFilterValueInput: React.FC<InputProps> = (props) => {
  const { value, onValueChange } = useActiveFilterContext()

  return (
    <Input
      type="text"
      value={value?.toString()}
      size="sm"
      autoFocus
      variant="flushed"
      width="80px"
      px="0"
      bg="none"
      borderRadius="0"
      placeholder="Enter a value..."
      onChange={(e) => {
        onValueChange?.(e.target.value)
      }}
      {...props}
    />
  )
}

export interface ActiveFilterRootProps
  extends GroupProps,
    SlotRecipeProps<'activeFilter'>,
    ActiveFilterVariantProps {}

export const ActiveFilterRoot = React.forwardRef<
  HTMLDivElement,
  ActiveFilterRootProps
>(function ActiveFilterRoot(props, ref) {
  const { children, ...rest } = props

  const recipe = useSlotRecipe({
    key: 'suiActiveFilter',
    recipe: props.recipe ?? activeFilterSlotRecipe,
  })

  const [variantProps, groupProps] = recipe.splitVariantProps(rest)

  const styles = recipe(variantProps)

  return (
    <ClassNamesProvider value={recipe.classNameMap}>
      <StylesProvider value={styles}>
        <Group
          ref={ref}
          {...groupProps}
          css={[styles.root, rest.css]}
          className={cx(recipe.classNameMap.activeFilter, props.className)}
        >
          {children}
        </Group>
      </StylesProvider>
    </ClassNamesProvider>
  )
})

export interface ActiveFilterLabelProps extends HTMLChakraProps<'div'> {
  icon?: React.ReactNode
  iconSpacing?: SystemStyleObject['marginRight']
}

export const ActiveFilterLabel: React.FC<ActiveFilterLabelProps> = (props) => {
  const { children, icon, iconSpacing = 2, ...rest } = props

  const styles = useStyles()

  const _icon = React.isValidElement(icon)
    ? React.cloneElement<any>(icon, {
        'aria-hidden': true,
        focusable: false,
      })
    : null

  return (
    <chakra.div
      {...rest}
      css={[styles.label, rest.css]}
      className={cx('sui-active-filter__label', props.className)}
    >
      {_icon && (
        <chakra.span marginEnd={iconSpacing} display="inline-flex">
          {_icon}
        </chakra.span>
      )}
      <chakra.span>{children}</chakra.span>
    </chakra.div>
  )
}

ActiveFilterLabel.displayName = 'ActiveFilterLabel'

export interface ActiveFilterOperatorProps
  extends Omit<MenuRootProps, 'children'>,
    UseFilterOperatorProps {
  items?: FilterItem[]
  triggerProps?: MenuTriggerProps
  contentProps?: MenuContentProps
  portalled?: boolean
  children?: React.ReactNode
}

/**
 * ActiveFilterOperator
 */
export const ActiveFilterOperator: React.FC<ActiveFilterOperatorProps> = (
  props,
) => {
  const { items, triggerProps, contentProps, portalled, ...rest } = props

  const styles = useStyles()

  const [operatorProps, menuProps] = splitProps(rest, [
    'value',
    'defaultValue',
    'onChange',
  ])

  const { label, getItemProps } = useFilterOperator(operatorProps)

  return (
    <Menu.Root {...menuProps}>
      <Menu.Trigger
        {...triggerProps}
        css={[styles.operator, triggerProps]}
        className={cx('sui-active-filter__operator')}
        asChild
      >
        <ActiveFilterButton>{label}</ActiveFilterButton>
      </Menu.Trigger>
      <Menu.Content zIndex="dropdown" portalled={portalled} {...contentProps}>
        {items?.map((item) => (
          <Menu.Item key={item.id} value={item.id} {...getItemProps(item)}>
            {item.icon}
            <Box flex="1">{item.label}</Box>
          </Menu.Item>
        ))}
      </Menu.Content>
    </Menu.Root>
  )
}

ActiveFilterOperator.displayName = 'ActiveFilterOperator'

export interface ActiveFilterValueProps
  extends ActiveFilterValueOptions,
    Omit<HTMLChakraProps<'div'>, 'onChange' | 'defaultValue' | 'value'> {}

export const ActiveFilterValue: React.FC<ActiveFilterValueProps> = (props) => {
  const { children, ...rest } = props

  const [, htmlProps] = splitProps(rest, [
    'defaultValue',
    'items',
    'multiple',
    'onChange',
    'value',
  ])

  const styles = useStyles()

  const { item, label, getMenuProps, isLoading, isFetched } =
    useFilterValue(props)

  const [, menuProps] = splitProps(getMenuProps(), ['icon'])

  if (typeof menuProps.items === 'function' || menuProps.items?.length) {
    return (
      <FilterMenu
        {...menuProps}
        buttonProps={{
          as: ActiveFilterButton,
          variant: 'ghost',
          borderRadius: 0,
          // icon: item?.icon,
          loading: isLoading && !isFetched,
          css: styles.valueButton,
        }}
      />
    )
  }

  return (
    <chakra.div
      {...htmlProps}
      css={[styles.value, htmlProps.css]}
      className={cx('sui-active-filter__value', props.className)}
    >
      {children || label}
    </chakra.div>
  )
}

ActiveFilterValue.displayName = 'ActiveFilterValue'

export interface ActiveFilterRemoveProps extends HTMLChakraProps<'button'> {}

export const ActiveFilterRemove: React.FC<ActiveFilterRemoveProps> = (
  props,
) => {
  const styles = useStyles()

  const removeStyles = {
    px: 2,
    ...styles.remove,
  }
  return (
    <IconButton
      as="div"
      aria-label="Remove filter"
      role="button"
      variant="ghost"
      colorPalette="gray"
      tabIndex={0}
      {...props}
      css={[removeStyles, props.css]}
      className={cx('sui-active-filter__remove', props.className)}
    >
      <XIcon />
    </IconButton>
  )
}

ActiveFilterRemove.displayName = 'ActiveFilterRemove'

const ActiveFilterButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function ActiveFilterButton(props, ref) {
    const styles = useStyles()

    return (
      <Button
        ref={ref}
        as="div"
        role="button"
        variant="ghost"
        tabIndex={0}
        {...props}
        css={[styles.valueButton, props.css]}
      />
    )
  },
)

ActiveFilterButton.displayName = 'ActiveFilterButton'

export interface ActiveFiltersListProps
  extends FlexProps,
    ActiveFilterVariantProps {
  formatValue?(value: FilterValue): string
  renderValue?: FilterRenderFn
}

export const ActiveFiltersList: React.FC<ActiveFiltersListProps> = (props) => {
  const { formatValue, renderValue, children, size, variant, ...rest } = props
  const {
    activeFilters,
    getOperators,
    getFilter,
    enableFilter,
    disableFilter,
  } = useFiltersContext()

  const recipe = useRecipe({
    key: 'suiActiveFiltersList',
  })

  const [variantProps, flexProps] = recipe.splitVariantProps(rest)

  const styles = recipe(variantProps)

  return activeFilters?.length ? (
    <Flex flexWrap="wrap" gap="1" {...flexProps} css={[styles, rest.css]}>
      {activeFilters?.map((activeFilter) => {
        const { key, id, value, operator } = activeFilter

        const filter = getFilter(id)

        const operators = getOperators(filter?.type).filter(({ id }) => {
          if (filter?.operators && !filter.operators.includes(id)) {
            return false
          }

          return true
        })

        const multiple = !!filter?.multiple

        const activeFilterProps: ActiveFilterProps = {
          id,
          value,
          operator,
          multiple,
          icon: filter?.icon,
          label: filter?.activeLabel || filter?.label,
          defaultOperator: filter?.defaultOperator,
          items: filter?.items,
          operators,
          type: filter?.type,
          size,
          variant,
          onValueChange: (value: FilterValue) => {
            enableFilter({ key, ...activeFilter, value })
          },
          onOperatorChange: (operator: FilterOperatorId) => {
            enableFilter({ key, ...activeFilter, operator })
          },
          onRemove: () => key && disableFilter(key),
          formatValue,
          renderValue,
        }

        return <ActiveFilter key={key} {...activeFilterProps} />
      })}
      {children}
    </Flex>
  ) : null
}

export const ResetFilters: React.FC<ButtonProps> = (props) => {
  const { children, ...rest } = props
  const { reset } = useFiltersContext()
  return (
    <Button variant="ghost" size="sm" {...rest} onClick={reset}>
      {children}
    </Button>
  )
}
