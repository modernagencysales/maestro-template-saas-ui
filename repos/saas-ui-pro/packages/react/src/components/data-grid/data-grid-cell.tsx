import React from 'react'
import { memo, useMemo } from 'react'

import { type Cell, type Table, flexRender } from '@tanstack/react-table'

import { dataAttr } from '../../utils/dom'
import { runIfFn } from '../../utils/run-if-fn'
import { TableCell } from './data-grid-primitives.tsx'
import type { DataGridSlotProps } from './data-grid.types'
import { escapeId } from './data-grid.utils'
import { getPinnedStyles, isGroupColumn } from './utils'

export interface DataGridCellProps<Data extends object = object> {
  instance: Table<Data>
  slotProps?: DataGridSlotProps<Data>
  cell: Cell<Data, unknown>
  index: number
}

export function DataGridCell<Data extends object = object>(
  props: DataGridCellProps<Data>,
) {
  const { instance, cell, index, slotProps } = props
  const column = cell.column
  const meta = column.columnDef.meta ?? {}

  const colId = escapeId(column.id)

  const cellProps = useMemo(
    () =>
      runIfFn(slotProps?.cell, {
        cell,
        table: instance,
      }),
    [slotProps, cell, instance],
  )

  const isColumnPinned = !isGroupColumn(column) && column.getIsPinned()

  const pinnedStyles = getPinnedStyles(column)

  const isFirst = column.getIsFirstColumn(isColumnPinned)
  const isLast = column.getIsLastColumn(isColumnPinned)

  const styles = useMemo(
    () => ({
      flexBasis: `calc(var(--col-${colId}-size) * 1px)`,
      flexShrink: 0,
      flexGrow: 'var(--column-grow, 1)',
      width: `calc(var(--col-${colId}-size) * 1px)`,
      minWidth: `max(var(--col-${colId}-size) * 1px, 40px)`,
    }),
    [colId],
  )

  return (
    <TableCell
      data-numeric={meta.isNumeric ? '' : undefined}
      data-col={index}
      data-pinned={isColumnPinned ? isColumnPinned : undefined}
      data-range-selected={cell.getIsInSelectionRange() ? '' : undefined}
      data-first={dataAttr(isFirst)}
      data-last={dataAttr(isLast)}
      userSelect={
        instance.options.experimental_enableCellSelection ? 'none' : undefined
      }
      {...meta.cellProps}
      {...cellProps}
      style={pinnedStyles as Record<string, string>}
      css={[styles, meta.cellProps?.css, cellProps?.css]}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  )
}

export const MemoizedDataGridCell = memo(DataGridCell, (prev, next) => {
  return prev.cell === next.cell
}) as typeof DataGridCell
