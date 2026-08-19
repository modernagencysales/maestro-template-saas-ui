import type { Column } from '@tanstack/react-table'

export const isGroupColumn = <TData, TValue>(column: Column<TData, TValue>) =>
  'columnDefType' in column.columnDef &&
  column.columnDef.columnDefType === 'group'

export const getPinnedStyles = (column: Column<any, any>) => {
  const isColumnPinned = !isGroupColumn(column) && column.getIsPinned()

  if (!isColumnPinned) {
    return {}
  }

  return isColumnPinned === 'left'
    ? {
        '--pinned-left': column.getStart('left') + 'px',
      }
    : {
        '--pinned-right': column.getAfter('right') + 'px',
      }
}
