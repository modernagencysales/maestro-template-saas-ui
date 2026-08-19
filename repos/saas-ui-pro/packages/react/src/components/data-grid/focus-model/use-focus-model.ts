import React from 'react'

import type {
  Cell,
  Row,
  RowData,
  RowSelectionState,
  Table,
} from '@tanstack/react-table'

import { FocusModel, type FocusModelOptions } from './focus-model'

export interface FocusModelProps<TData extends RowData>
  extends Pick<FocusModelOptions, 'mode'> {
  rootRef?: React.RefObject<HTMLDivElement | HTMLTableElement>
  table: Table<TData>
  onFocusChange?: (details: {
    row: Row<TData>
    cell: Cell<TData, unknown>
  }) => void
}

export const useFocusModel = <TData extends RowData>(
  props: FocusModelProps<TData>,
) => {
  const { mode = 'list', table, onFocusChange } = props

  const tableRef = React.useRef<HTMLTableElement | HTMLDivElement>(null)

  const [focusModel, setFocusModel] = React.useState<FocusModel | null>(null)

  React.useEffect(() => {
    if (!tableRef.current) {
      return
    }

    const focusModel = new FocusModel(tableRef.current, {
      mode,
      onFocusChange: (state) => {
        if (onFocusChange) {
          const row = table.getRowModel().rows[state.row]
          const cell = row.getVisibleCells()[state.column]
          onFocusChange({ row, cell })
        }
      },
      getSelectedRows: () => {
        return Object.keys(table.getState().rowSelection)
      },
      onSelectRows: (start, end) => {
        const rows = table.getRowModel().rows

        if (!end) {
          rows[start].toggleSelected(true)
          return
        }

        const selectIds = rows
          .slice(start, end + 1)
          .map((row) => row.id)
          .filter(Boolean)

        table.setRowSelection(() => {
          const selections: RowSelectionState = {}

          for (const id of selectIds) {
            selections[id] = true
          }

          return selections
        })
      },
      onToggleRowSelected: (rowIndex) => {
        const rows = table.getRowModel().rows
        const row = rows[rowIndex]
        if (row.getCanSelect()) {
          row.toggleSelected(!row.getIsSelected())
        }
      },
      onCollapseRow: (row) => {
        const rows = table.getRowModel().rows
        rows[row]?.toggleExpanded(false)
      },
    })

    setFocusModel(focusModel)

    return () => {
      focusModel?.destroy()
    }
  }, [table])

  const getRowProps = React.useCallback(
    (row: Row<TData>) => {
      const rows = table.getRowModel().rows
      const rowIndex = rows.indexOf(row)

      if (mode === 'grid') {
        return {
          'data-row': rowIndex,
        }
      } else if (mode !== 'list') {
        return
      }

      return {
        ['data-row']: rowIndex,
      }
    },
    [mode, table],
  )

  const getCellProps = React.useCallback(
    (cell: Cell<TData, any>) => {
      if (mode !== 'grid') {
        return
      }

      const visibleColumns = table.getVisibleFlatColumns()
      const columnIndex = visibleColumns.findIndex(
        (col) => col.id === cell.column.id,
      )

      return {
        ['data-col']: columnIndex,
      }
    },
    [mode, table],
  )

  return {
    getRowProps,
    getCellProps,
    tableRef,
    setFocusedRow: focusModel?.setFocusedRow,
    setFocusedCell: focusModel?.setFocusedCol,
  }
}

export type UseFocusModelReturn<Data extends RowData> = ReturnType<
  typeof useFocusModel<Data>
>
