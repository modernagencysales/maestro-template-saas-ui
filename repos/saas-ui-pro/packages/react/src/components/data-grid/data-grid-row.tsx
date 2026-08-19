import { memo, useCallback, useMemo } from 'react'

import type { Cell, Row, Table } from '@tanstack/react-table'
import type { VirtualItem } from '@tanstack/react-virtual'

import { callAll, dataAttr } from '../../utils/dom'
import { runIfFn } from '../../utils/run-if-fn'
import { DataGridCell } from './data-grid-cell'
import { TableRow, type TableRowProps } from './data-grid-primitives.tsx'
import type { DataGridVirtualizer } from './data-grid-virtualizer'
import type { DataGridSlotProps } from './data-grid.types'
import type { UseFocusModelReturn } from './focus-model/use-focus-model'

export interface DataGridRowProps<Data extends object> {
  instance: Table<Data>
  slotProps?: DataGridSlotProps<Data>
  row: Row<Data>
  rowIndex: number
  virtualRow?: VirtualItem
  virtualizer: DataGridVirtualizer
  isSelectable?: boolean
  isExpandable?: boolean
  isHoverable?: boolean
  onClick: (e: React.MouseEvent) => void
  focusModel?: UseFocusModelReturn<Data>
}

export const DataGridRow = function DataGridRow<Data extends object>(
  props: DataGridRowProps<Data>,
) {
  const {
    instance,
    slotProps,
    row,
    rowIndex,
    virtualRow,
    virtualizer,
    isSelectable,
    isExpandable,
    isHoverable,
    onClick,
    focusModel,
  } = props

  const visibleCells = row.getVisibleCells()
  const virtualColumns = virtualizer.column?.getVirtualItems()

  const columns = virtualColumns ?? visibleCells

  const ariaProps: TableRowProps = {}
  if (isExpandable) {
    ariaProps['aria-expanded'] = row.getIsExpanded()
  }
  if (isSelectable) {
    ariaProps['aria-selected'] = row.getIsSelected()
  }

  const rowProps = useMemo(
    () =>
      runIfFn(slotProps?.row, {
        row,
        table: instance,
      }),
    [slotProps, row, instance],
  )

  const { virtualPaddingLeft, virtualPaddingRight } = virtualizer.column ?? {}

  const memoizedStyle = useMemo(
    () =>
      ({
        '--row-depth': String(row.depth),
        position: virtualRow ? 'absolute' : undefined,
        top: virtualRow ? '0' : undefined,
        transform: virtualRow
          ? `translateY(${virtualRow?.start}px)`
          : undefined,
      }) as Record<string, string>,
    [row.depth, virtualRow],
  )

  const memoizedOnClick = useCallback(
    (e: React.MouseEvent) => callAll(onClick, props?.onClick)(e),
    [onClick, props?.onClick],
  )

  return (
    <TableRow
      {...rowProps}
      ref={(el) => {
        virtualizer?.row?.measureElement(el)
      }}
      onClick={memoizedOnClick}
      data-row={rowIndex}
      data-selected={dataAttr(row.getIsSelected())}
      data-interactive={dataAttr(isHoverable)}
      {...ariaProps}
      {...focusModel?.getRowProps(row)}
      style={memoizedStyle}
    >
      {virtualPaddingLeft ? (
        <td style={{ display: 'flex', width: virtualPaddingLeft }} />
      ) : null}
      {columns.map((cellOrVirtual, index) => {
        let cell = cellOrVirtual as Cell<Data, unknown>

        if (virtualizer.column && 'index' in cellOrVirtual) {
          cell = visibleCells[cellOrVirtual.index]
          index = cellOrVirtual.index
        }

        const key = `${cell.id}`

        return (
          <DataGridCell
            key={key}
            slotProps={slotProps}
            instance={instance}
            cell={cell}
            index={index}
          />
        )
      })}
      {virtualPaddingRight ? (
        <td style={{ display: 'flex', width: virtualPaddingRight }} />
      ) : null}
    </TableRow>
  )
}

DataGridRow.displayName = 'DataGridRow'

export const MemoizedDataGridRow = memo(DataGridRow, (prev, next) => {
  return prev.row === next.row && prev.rowIndex === next.rowIndex
}) as typeof DataGridRow
