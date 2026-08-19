'use client'

import * as React from 'react'

import type { IconButtonProps, InputProps } from '@chakra-ui/react'
import { Field, Input, chakra, useSlotRecipe } from '@chakra-ui/react'

import { ChevronLeftIcon, ChevronRightIcon } from '../../icons'
import {
  Pagination as PaginationPrimitive,
  type PaginationRootProps,
} from '../../internal/pagination'
import { callAll, cx } from '../../utils/dom'
import { formatMessage } from '../../utils/format-message'
import { useDataGridContext, useDataGridIcons } from './data-grid-context'

export interface RootProps extends PaginationRootProps {}

/**
 * @example
 * ```tsx
 * <DataGridPagination.Root>
 *   <DataGridPagination.PageControl />
 *
 *   <DataGridPagination.PreviousButton />
 *   <DataGridPagination.Items />
 *   <DataGridPagination.NextButton />
 * </DataGridPagination.Root>
 * ```
 */
export const Root = React.forwardRef<
  HTMLDivElement,
  Omit<RootProps, 'count' | 'page' | 'pageSize'>
>(function DataGridPaginationRoot(props, ref) {
  const { children, ...rest } = props
  const { instance } = useDataGridContext()

  const state = instance.getState()

  const {
    pagination: { pageIndex, pageSize },
  } = state

  const recipe = useSlotRecipe({
    key: 'suiDataGridPagination',
  })

  const [variantProps, otherProps] = recipe.splitVariantProps(rest)

  const styles = recipe(variantProps)

  return (
    <PaginationPrimitive.Root
      ref={ref}
      {...otherProps}
      className={cx(recipe.classNameMap['root'], props.className)}
      count={instance.getRowCount()}
      page={pageIndex + 1}
      pageSize={pageSize}
      onPageChange={callAll(props.onPageChange, ({ page, pageSize }) => {
        instance.setPagination({ pageIndex: page - 1, pageSize })
      })}
      onPageSizeChange={callAll(props.onPageSizeChange, ({ pageSize }) => {
        instance.setPageSize(pageSize)
      })}
      css={[styles.root, otherProps.css]}
    >
      {children}
    </PaginationPrimitive.Root>
  )
})

export const PageControl: React.FC<Partial<InputProps>> = (props) => {
  const { instance, translations } = useDataGridContext()

  const state = instance.getState()
  const pageCount = instance.getPageCount()

  const {
    pagination: { pageIndex },
  } = state

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const page = e.target.value ? Number(e.target.value) - 1 : 0
    instance.setPageIndex(page)
  }

  return (
    <Field.Root display="flex" flexDirection="row" alignItems="center">
      <Field.Label mb="0">{translations.page}</Field.Label>
      <Input
        type="number"
        value={props.value ?? pageIndex + 1}
        onChange={callAll(props.onChange, handleChange)}
        onFocus={(e) => e.target.select()}
        w="20"
        size="sm"
        {...props}
        disabled={props.disabled ?? pageCount === 0}
      />
      <chakra.span textStyle="sm">
        {formatMessage(translations.of, { pageCount })}
      </chakra.span>
    </Field.Root>
  )
}

export const NextButton: React.FC<Partial<IconButtonProps>> = (props) => {
  const { instance, translations } = useDataGridContext()

  const icons = useDataGridIcons()

  const icon = props.children ?? icons?.nextPage ?? <ChevronRightIcon />

  return (
    <PaginationPrimitive.NextButton
      {...props}
      disabled={!instance.getCanNextPage()}
      aria-label={translations.nextPage}
    >
      {icon}
    </PaginationPrimitive.NextButton>
  )
}

export const PreviousButton: React.FC<Partial<IconButtonProps>> = (props) => {
  const { instance, translations } = useDataGridContext()

  const icons = useDataGridIcons()

  const icon = props.children ?? icons?.previousPage ?? <ChevronLeftIcon />

  return (
    <PaginationPrimitive.PrevButton
      {...props}
      disabled={!instance.getCanPreviousPage()}
      aria-label={translations.previousPage}
    >
      {icon}
    </PaginationPrimitive.PrevButton>
  )
}

export const Ellipsis = PaginationPrimitive.Ellipsis
export const Items = PaginationPrimitive.Items
export const Item = PaginationPrimitive.Item
