import { memo } from 'react'

import type { Row, Table } from '@tanstack/react-table'
import {
  type VirtualItem,
  type VirtualizerOptions,
} from '@tanstack/react-virtual'

import type { DataGridProps } from './data-grid'
import { TableBody } from './data-grid-primitives.tsx'
import { DataGridRow, type DataGridRowProps } from './data-grid-row'
import {
  type DataGridColumnVirtualizer,
  useRowVirtualizer,
} from './data-grid-virtualizer'
import type { UseFocusModelReturn } from './focus-model/use-focus-model'

export function DataGridBody<Data extends object>(props: {
  instance: Table<Data>
  scrollRef: React.RefObject<HTMLDivElement>
  size: DataGridProps<Data>['size']
  slotProps: DataGridProps<Data>['slotProps']
  isSelectable?: boolean
  isExpandable?: boolean
  isHoverable?: boolean
  onRowClick?: (row: Row<Data>, event: React.MouseEvent) => void
  columnVirtualizer?: DataGridColumnVirtualizer | null
  rowVirtualizerOptions?: Partial<
    VirtualizerOptions<HTMLDivElement, HTMLTableRowElement>
  >
  focusModel?: UseFocusModelReturn<Data>
}) {
  const {
    instance,
    scrollRef,
    size,
    columnVirtualizer,
    rowVirtualizerOptions,
    slotProps,
    isSelectable,
    isExpandable,
    isHoverable,
    onRowClick,
    focusModel,
  } = props

  const rows = instance.getRowModel().rows

  const rowVirtualizer = useRowVirtualizer(rows, {
    estimateSize: () => {
      switch (size) {
        case 'xl':
          return 65
        case 'lg':
          return 53
        case 'sm':
          return 33
        case 'md':
        default:
          return 41
      }
    },
    getScrollElement: () => scrollRef.current!,
    ...rowVirtualizerOptions,
  })

  const virtualRows = rowVirtualizer?.getVirtualItems()

  const bodyHeight = rowVirtualizer?.getTotalSize()

  return (
    <TableBody
      position="relative"
      style={{
        height: bodyHeight ? bodyHeight + 'px' : undefined,
      }}
    >
      {(virtualRows ?? rows).map((rowOrVirtualRow, index) => {
        let row = rowOrVirtualRow as unknown as Row<Data>
        if (rowVirtualizer) {
          row = rows[rowOrVirtualRow.index]
          index = rowOrVirtualRow.index
        }

        if (!row) {
          return null
        }

        const props: DataGridRowProps<Data> = {
          instance,
          slotProps,
          row,
          rowIndex: index,
          virtualRow: rowVirtualizer
            ? (rowOrVirtualRow as unknown as VirtualItem)
            : undefined,
          virtualizer: {
            row: rowVirtualizer,
            column: columnVirtualizer,
          },
          isSelectable,
          isExpandable,
          isHoverable,
          ...focusModel?.getRowProps(row),
          onClick: (e: React.MouseEvent) => onRowClick?.(row, e),
        }

        const key = `${row.id}`

        return <DataGridRow key={key} {...props} />
      })}
    </TableBody>
  )
}

export const MemoizedDataGridBody = memo(DataGridBody) as typeof DataGridBody
