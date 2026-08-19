import React, { forwardRef } from 'react'

import { VisuallyHidden, chakra } from '@chakra-ui/react'
import type { ColumnDef } from '@tanstack/react-table'

import { Checkbox, type CheckboxProps } from '../../internal/checkbox'
import { useDataGridContext } from './data-grid-context'

export const getSelectionColumn = <Data extends object>(
  enabled?: boolean,
  columnDef?: ColumnDef<Data>,
) => {
  return enabled
    ? [
        {
          id: 'selection',
          size: 48,
          maxSize: 48,
          minSize: 48,
          enableHiding: false,
          enableSorting: false,
          enableColumnFilter: false,
          enableGlobalFilter: false,
          enableGrouping: false,
          enableMultiSort: false,
          enableResizing: false,
          header: ({ table }) => (
            <DataGridCheckbox
              checked={
                table.getIsSomeRowsSelected()
                  ? 'indeterminate'
                  : table.getIsAllRowsSelected()
              }
              onChange={table.getToggleAllRowsSelectedHandler()}
            />
          ),
          cell: ({ row }) => (
            <DataGridCheckbox
              checked={
                row.getIsSomeSelected() ? 'indeterminate' : row.getIsSelected()
              }
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
              isRow
            />
          ),
          meta: {
            headerProps: {
              flex: 0,
            },
            titleProps: {
              py: 0,
            },
            cellProps: {
              flex: 0,
            },
          },
          ...columnDef,
        } as ColumnDef<Data>,
      ]
    : []
}

export const DataGridCheckbox = forwardRef<
  HTMLInputElement,
  CheckboxProps & { isRow?: boolean }
>(function DataGridCheckbox(props, ref) {
  const { isRow, ...rest } = props

  const onClick = React.useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    [],
  )

  const { colorPalette, translations } = useDataGridContext()

  let label = props.checked ? translations.deselectRow : translations.selectRow

  if (!isRow) {
    label = props.checked
      ? translations.deselectAllRows
      : translations.selectAllRows
  }

  return (
    <chakra.div
      onClick={onClick}
      css={{
        display: 'inline-flex',
        '& .chakra-checkbox__label': {
          ms: 0,
        },
      }}
    >
      <Checkbox
        ref={ref}
        display="inline-flex"
        verticalAlign="middle"
        colorPalette={colorPalette}
        {...rest}
      >
        <VisuallyHidden>{label}</VisuallyHidden>
      </Checkbox>
    </chakra.div>
  )
})
