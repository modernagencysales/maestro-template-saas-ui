import React from 'react'

import type {
  ColumnDef,
  ColumnHelper,
  DisplayColumnDef,
  RowData,
} from '@tanstack/react-table'
import { createColumnHelper } from '@tanstack/react-table'

/**
 * Returns a memoized array of columns.
 *
 * @see https://tanstack.com/table/v8/docs/guide/column-defs#column-helpers
 *
 * @param columnHelper Tanstack table column helper
 */
export const useColumns = <Data extends RowData, Columns = unknown>(
  factory: (
    columnHelper: Pick<ColumnHelper<Data>, 'accessor' | 'display'> & {
      actions: (
        column: Omit<DisplayColumnDef<Data>, 'id'>,
      ) => DisplayColumnDef<Data, unknown>
    },
  ) => Array<Columns>,
  deps: React.DependencyList,
) =>
  React.useMemo(() => {
    const columnHelper = createColumnHelper<Data>()
    return factory({
      ...columnHelper,
      actions: (column) =>
        columnHelper.display({
          header: '',
          ...column,
          id: '_actions_',
          enableSorting: false,
          enableResizing: false,
          enableColumnFilter: false,
          enableGrouping: false,
          enableGlobalFilter: false,
          enableMultiSort: false,
        }),
    }) as Array<ColumnDef<Data>>
  }, [...deps])
