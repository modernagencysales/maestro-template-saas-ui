import { type Header, flexRender } from '@tanstack/react-table'

import { dataAttr } from '../../utils/dom'
import { DataGridColumnResizer } from './data-grid-column-resizer'
import { TableColumnHeader, TableColumnTitle } from './data-grid-primitives.tsx'
import { DataGridSort } from './data-grid-sort'
import { escapeId } from './data-grid.utils'
import { getPinnedStyles, isGroupColumn } from './utils'

export interface DataGridHeaderCellProps<Data extends object, TValue> {
  header: Header<Data, TValue>
  isSortable?: boolean
}

export const DataGridHeaderCell = <Data extends object, TValue>(
  props: DataGridHeaderCellProps<Data, TValue>,
) => {
  const { header, isSortable, ...rest } = props

  let titleProps = {}

  const column = header.column

  if (isSortable && column.getCanSort()) {
    const sorted = column.getIsSorted()
    titleProps = {
      userSelect: 'none',
      cursor: 'pointer',
      tabIndex: 0,
      'aria-sort': sorted
        ? sorted === 'desc'
          ? 'descending'
          : 'ascending'
        : 'none',
      onClick: column.getToggleSortingHandler(),
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
          column.toggleSorting()
        }
      },
    }
  }

  const isColumnPinned = !isGroupColumn(column)
    ? column.getIsPinned()
    : undefined
  const isFirst = column.getIsFirstColumn(isColumnPinned)
  const isLast = column.getIsLastColumn(isColumnPinned)

  const headerStyle = getPinnedStyles(column)

  const meta = (header.column.columnDef.meta || {}) as any

  const colId = escapeId(header.id)

  return (
    <TableColumnHeader
      scope="col"
      colSpan={header.colSpan}
      data-numeric={meta.isNumeric ? '' : undefined}
      data-pinned={isColumnPinned ? isColumnPinned : undefined}
      data-first={dataAttr(isFirst)}
      data-last={dataAttr(isLast)}
      flexBasis={`calc(var(--header-${colId}-size) * 1px)`}
      flexShrink={0}
      flexGrow="var(--column-grow, 1)"
      width={`calc(var(--header-${colId}-size) * 1px)`}
      minWidth={`max(var(--col-${colId}-size) * 1px, 40px)`}
      {...meta.headerProps}
      {...rest}
      style={{
        ...headerStyle,
        ...meta.headerProps?.style,
      }}
    >
      <TableColumnTitle {...meta.titleProps} {...titleProps}>
        {flexRender(header.column.columnDef.header, header.getContext())}
        {isSortable && <DataGridSort header={header} />}
      </TableColumnTitle>
      <DataGridColumnResizer header={header} />
    </TableColumnHeader>
  )
}

DataGridHeaderCell.displayName = 'DataGridHeaderCell'
