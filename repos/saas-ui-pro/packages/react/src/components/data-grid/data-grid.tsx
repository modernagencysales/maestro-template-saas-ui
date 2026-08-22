'use client'

import * as React from 'react'

import {
  type HTMLChakraProps,
  type SlotRecipeProps,
  mergeRefs,
  useCallbackRef,
  useChakraContext,
} from '@chakra-ui/react'
import type {
  ColumnSort,
  Row,
  Table as TableInstance,
  TableOptions,
} from '@tanstack/react-table'
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { VirtualizerOptions } from '@tanstack/react-virtual'

import { cx } from '../../utils/dom'
import { runIfFn } from '../../utils/run-if-fn'
import { CellSelectionFeature } from './cell-selection/cell-selection-feature'
import { DataGridBody } from './data-grid-body'
import { DataGridCellValue } from './data-grid-cell-value'
import { getSelectionColumn } from './data-grid-checkbox'
import { type DataGridIcons, DataGridProvider } from './data-grid-context'
import { getExpanderColumn } from './data-grid-expander'
import { DataGridFooter } from './data-grid-footer'
import { DataGridHeader } from './data-grid-header'
import {
  DataGridRoot,
  DataGridScrollArea,
  Table,
} from './data-grid-primitives.tsx'
import type { DataGridTranslations } from './data-grid-translations'
import { useColumnVirtualizer } from './data-grid-virtualizer'
import type { DataGridVariantProps } from './data-grid.recipe.ts'
import type { DataGridSlotProps, FocusChangeHandler } from './data-grid.types'
import { escapeId } from './data-grid.utils'
import { type FocusMode, useFocusModel } from './focus-model'
import { NoResults } from './no-results'

export interface DataGridProps<Data extends object>
  extends Omit<TableOptions<Data>, 'getCoreRowModel'>,
    SlotRecipeProps<'suiDataGrid'>,
    DataGridVariantProps,
    Pick<HTMLChakraProps<'div'>, 'className' | 'css' | 'colorPalette'> {
  /**
   * The React Table instance reference
   */
  instanceRef?: React.Ref<TableInstance<Data>>
  /**
   * Enable sorting on all columns
   */
  isSortable?: boolean
  /**
   * Enable row selection
   */
  isSelectable?: boolean
  /**
   * Enable row hover styles
   */
  isHoverable?: boolean
  /**
   * Enable expandable rows
   */
  isExpandable?: boolean
  /**
   * Column resize mode
   */
  columnResizeMode?: 'onChange' | 'onEnd'
  /**
   * Column resize direction
   */
  columnResizeDirection?: 'ltr' | 'rtl'
  /**
   * Enable column resizing
   *
   * layoutMode will be set to `fixed` when columnResizeEnabled is true.
   *
   * @default false
   */
  columnResizeEnabled?: boolean
  /**
   * Triggers whenever the row selection changes.
   * @params rows The selected row id'
   */
  onSelectedRowsChange?: (rows: Array<string>) => void
  /**
   * Triggers when sort changed.
   * Use incombination with `manualSortBy` to enable remote sorting.
   */
  onSortChange?: (columns: ColumnSort[]) => void
  /**
   * Callback fired when a row or cell is focused.
   */
  onFocusChange?: FocusChangeHandler<Data>
  /**
   * Callback fired when a row is clicked.
   */
  onRowClick?: (row: Row<Data>, e: React.MouseEvent, meta?: any) => void
  /**
   * Callback fired when clear filters is clicked.
   */
  onResetFilters?: () => void
  /**
   * Use this for controlled pagination.
   */
  pageCount?: number
  /**
   * Empty state component, rendered when there is no data and no filters enabled.
   */
  emptyState?: React.FC<any>
  /**
   * No results component, rendered when filters are enabled and there are no results.
   */
  noResults?: React.FC<any>
  /**
   * Enable keyboard navigation
   * @default 'list'
   */
  focusMode?: FocusMode
  /**
   * Set the layout mode of columns.
   *
   * - `grow` will make columns grow to fill the available space.
   * - `fixed` will make columns have a fixed width.
   *
   * Defaults to `grow`, but will be set to `fixed` when columnResizeEnabled is true.
   *
   * @default 'grow'
   */
  layoutMode?: 'grow' | 'fixed'
  /**
   * The table class name attribute
   */
  className?: string
  /**
   * Set to false to disable sticky headers
   * @default true
   */
  stickyHeader?: boolean
  /**
   * Set to false to disable sticky footer
   * @default true
   */
  stickyFooter?: boolean
  /**
   * DataGrid children
   */
  children?: React.ReactNode
  /**
   * Callback fired when the grid is scrolled.
   */
  onScroll?: React.UIEventHandler<HTMLDivElement>
  /**
   * React Virtual options for the column virtualizer
   * Disabled by default
   * @see https://tanstack.com/virtual/v3/docs/adapters/react-virtual
   */
  columnVirtualizerOptions?: Partial<
    VirtualizerOptions<HTMLDivElement, HTMLTableRowElement>
  > & { enabled?: boolean }
  /**
   * React Virtual options for the row virtualizer
   * @see https://tanstack.com/virtual/v3/docs/adapters/react-virtual
   */
  rowVirtualizerOptions?: Partial<
    VirtualizerOptions<HTMLDivElement, HTMLTableRowElement>
  > & { enabled?: boolean }
  /**
   * Custom icons
   * This prop is memoized and will not update after initial render.
   */
  icons?: DataGridIcons
  /**
   * Pass custom properties to child (slots) components.
   */
  slotProps?: DataGridSlotProps<Data>
  /**
   * Custom translations
   */
  translations?: Partial<DataGridTranslations>
}

export const DataGrid = React.forwardRef(
  <Data extends object>(
    props: DataGridProps<Data>,
    ref: React.ForwardedRef<HTMLTableElement>,
  ) => {
    const {
      instanceRef,
      columns,
      data,
      initialState,
      getSubRows = (row: any) => row.subRows,
      defaultColumn,
      getRowId,
      isSortable,
      isSelectable,
      isHoverable = true,
      isExpandable,
      columnResizeMode = 'onChange',
      columnResizeEnabled = false,
      onSelectedRowsChange,
      onSortChange,
      onFocusChange,
      onRowClick,
      onResetFilters,
      onScroll,
      emptyState: EmptyStateComponent = NoResults,
      noResults: NoResultsComponent = NoResults,
      pageCount,
      focusMode = 'list',
      layoutMode = columnResizeEnabled ? 'fixed' : 'grow',
      colorPalette,
      size,
      variant,
      striped,
      stickyHeader = true,
      stickyFooter = true,
      className,
      css,
      columnVirtualizerOptions,
      rowVirtualizerOptions,
      icons,
      slotProps,
      translations,
      children,
      ...rest
    } = props

    const sys = useChakraContext()
    const recipe = React.useMemo(() => sys.getSlotRecipe('suiDataGrid'), [sys])

    const instance = useReactTable<Data>({
      columns: React.useMemo(() => {
        const selectionColumn =
          columns?.[0]?.id === 'selection' ? columns[0] : undefined

        const expanderColumn = columns.find(({ id }) => id === 'expand')

        return getSelectionColumn<Data>(isSelectable, selectionColumn)
          .concat(getExpanderColumn(isExpandable, expanderColumn))
          .concat(
            columns
              ?.filter(({ id }) => id !== 'selection')
              .map((column: any) => {
                if (!column.accessorKey && column.id) {
                  column.accessorKey = column.id
                }

                if (!column.cell) {
                  column.cell = DataGridCellValue
                }

                column.enableResizing = columnResizeEnabled
                  ? column.enableResizing
                  : false

                return column
              }),
          )
      }, [columns, columnResizeEnabled]),
      data,
      initialState: React.useMemo(() => initialState, []),
      defaultColumn,
      getSubRows,
      getRowId,
      manualPagination: pageCount !== undefined,
      pageCount,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      columnResizeMode,
      ...rest,
      _features: [CellSelectionFeature, ...(rest._features ?? [])],
    })

    const focusModel = useFocusModel({
      mode: focusMode,
      table: instance,
      onFocusChange,
    })

    // This exposes the useTable api through the tableRef
    React.useImperativeHandle(instanceRef, () => instance, [instanceRef])

    const state = instance.getState()
    const rows = instance.getRowModel().rows

    const scrollRef = React.useRef<HTMLDivElement>(null)

    const columnVirtualizer = useColumnVirtualizer(instance, {
      enabled: false,
      getScrollElement: () => scrollRef.current,
      ...columnVirtualizerOptions,
    })

    const _onSelectedRowsChange = useCallbackRef(onSelectedRowsChange)

    React.useEffect(() => {
      _onSelectedRowsChange?.(Object.keys(state.rowSelection))
    }, [_onSelectedRowsChange, state.rowSelection, instance])

    const _onSortChange = useCallbackRef(onSortChange)

    React.useEffect(() => {
      _onSortChange?.(state.sorting)
    }, [_onSortChange, state.sorting])

    const _onRowClick = useCallbackRef(onRowClick)

    const noResults =
      !rows.length &&
      (state.columnFilters.length || state.globalFilter ? (
        <NoResultsComponent onReset={onResetFilters} />
      ) : (
        <EmptyStateComponent />
      ))

    const { columnSizing, columnSizingInfo, columnVisibility } = state

    const columnSizeVars = React.useMemo(() => {
      const headers = instance.getFlatHeaders()
      const colSizes: { [key: string]: number } = {
        '--column-grow': layoutMode === 'grow' ? 1 : 0,
      }
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i]!
        colSizes[`--header-${escapeId(header.id)}-size`] = header.getSize()
        colSizes[`--col-${escapeId(header.column.id)}-size`] =
          header.column.getSize()
      }
      return colSizes
    }, [
      instance,
      columns,
      columnSizing,
      columnSizingInfo,
      columnVisibility,
      layoutMode,
    ])

    const expandedDepth = instance.getExpandedDepth()

    const expandedVars: { [key: string]: number } =
      isExpandable && expandedDepth
        ? {
            '--expanded-depth': expandedDepth,
          }
        : {}

    const tableProps = runIfFn(slotProps?.table, { table: instance })

    const table = (
      <Table
        ref={mergeRefs(ref, focusModel.tableRef, instance.setRootNode)}
        {...tableProps}
        style={{
          ...columnSizeVars,
          ...expandedVars,
          ...tableProps?.style,
        }}
      >
        <DataGridHeader
          instance={instance}
          columnVirtualizer={columnVirtualizer}
          stickyHeader={stickyHeader}
          slotProps={slotProps}
          isSortable={isSortable}
        />
        <DataGridBody
          instance={instance}
          scrollRef={scrollRef}
          size={size}
          isHoverable={isHoverable}
          isExpandable={isExpandable}
          isSelectable={isSelectable}
          slotProps={slotProps}
          columnVirtualizer={columnVirtualizer}
          focusModel={focusModel}
          onRowClick={_onRowClick}
          rowVirtualizerOptions={rowVirtualizerOptions}
        />
        <DataGridFooter
          instance={instance}
          slotProps={slotProps}
          columnVirtualizer={columnVirtualizer}
          stickyFooter={stickyFooter}
        />
      </Table>
    )

    const containerProps = runIfFn(slotProps?.container, { table: instance })
    const innerProps = runIfFn(slotProps?.inner, { table: instance })

    return (
      <DataGridProvider<Data>
        instance={instance}
        variant={variant}
        size={size}
        striped={striped}
        slotProps={slotProps}
        icons={icons}
        translations={translations}
      >
        <DataGridRoot
          {...containerProps}
          css={[css, containerProps?.css]}
          className={cx(className, containerProps?.className)}
        >
          <DataGridScrollArea
            {...innerProps}
            ref={scrollRef}
            onScroll={onScroll}
          >
            {noResults || table}
          </DataGridScrollArea>
          {children}
        </DataGridRoot>
      </DataGridProvider>
    )
  },
) as (<Data extends object>(
  props: DataGridProps<Data> & {
    ref?: React.ForwardedRef<HTMLTableElement>
  },
) => React.ReactElement) & { displayName?: string }

DataGrid.displayName = 'DataGrid'
