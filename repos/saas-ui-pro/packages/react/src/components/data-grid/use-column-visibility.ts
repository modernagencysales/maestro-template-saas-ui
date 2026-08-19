import React from 'react'

import type { ColumnDef } from '@tanstack/react-table'

export interface UseColumnVisibilityProps<Data, VisibleColumns = string[]> {
  columns: ColumnDef<Data>[]
  visibleColumns?: VisibleColumns
}

/**
 * Helper hook to manage column visibility.
 * Only supports a single level of columns.
 */
export const useColumnVisibility = <Data extends object>(
  props: UseColumnVisibilityProps<Data>,
  deps?: React.DependencyList,
) => {
  const { columns, visibleColumns = [] } = props

  const getVisibleColumns = React.useCallback(
    (visibleColumns: string[]) => {
      return (
        columns.reduce<Record<string, boolean>>((memo, column) => {
          let id = column.id
          if (
            !id &&
            'accessorKey' in column &&
            typeof column.accessorKey === 'string'
          ) {
            id = column.accessorKey
          }
          if (id) {
            memo[id] =
              column.enableHiding !== false
                ? visibleColumns?.includes(id)
                : true
          }
          return memo
        }, {}) || {}
      )
    },
    [columns],
  )

  const [columnVisibility, setColumnVisibility] = React.useState(
    getVisibleColumns(visibleColumns),
  )

  React.useEffect(
    () => {
      setColumnVisibility(getVisibleColumns(visibleColumns))
    },
    deps || [visibleColumns],
  )

  return columnVisibility
}
