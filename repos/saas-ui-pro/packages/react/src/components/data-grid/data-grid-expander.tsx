import { forwardRef } from 'react'

import { IconButton, type IconButtonProps } from '@chakra-ui/react'
import type { ColumnDef } from '@tanstack/react-table'

import { ChevronDownIcon, ChevronRightIcon } from '../../icons'
import { useDataGridContext } from './data-grid-context'

export interface DataGridExpanderProps
  extends Omit<IconButtonProps, 'aria-label'> {
  isExpanded: boolean
  onToggle: (event: unknown) => void
  'aria-label'?: string
}

export const DataGridExpander = forwardRef<
  HTMLButtonElement,
  DataGridExpanderProps
>(function DataGridExpander(props, ref) {
  const { isExpanded, onToggle, ...rest } = props
  const { instance, icons, translations } = useDataGridContext()

  if (!instance.getCanSomeRowsExpand()) {
    return null
  }

  const expandedIcon = icons?.rowExpanded ?? <ChevronDownIcon />
  const collapsedIcon = icons?.rowCollapsed ?? <ChevronRightIcon />

  return (
    <IconButton
      ref={ref}
      size="xs"
      variant="ghost"
      fontSize="1.2em"
      {...rest}
      aria-label={
        isExpanded ? translations.collapseRows : translations.expandRows
      }
      onClick={onToggle}
    >
      {isExpanded ? expandedIcon : collapsedIcon}
    </IconButton>
  )
})

export const getExpanderColumn = <Data extends object>(
  enabled?: boolean,
  columnDef?: ColumnDef<Data>,
) => {
  return enabled
    ? [
        {
          id: 'expand',
          header: ({ table, column }) => {
            const meta = (column.columnDef.meta || {}) as any
            return (
              <DataGridExpander
                {...meta.expanderProps}
                isExpanded={table.getIsAllRowsExpanded()}
                onToggle={table.getToggleAllRowsExpandedHandler()}
              />
            )
          },
          size: 40,
          minSize: 40,
          enableSorting: false,
          enableColumnFilter: false,
          enableGlobalFilter: false,
          enableGrouping: false,
          enableMultiSort: false,
          enableResizing: false,
          meta: {
            headerProps: {
              flex: '0 0 calc(40px + var(--expanded-depth) * 4px)',
            },
            titleProps: {
              p: 2,
            },
            cellProps: {
              py: 2,
              flex: '0 0 calc(40px + var(--expanded-depth) * 4px)',
              textOverflow: 'initial',
              ps: 'calc(calc(var(--row-depth) + 1) * 0.5rem)',
            },
          },
          cell: ({ row, column }) => {
            const meta = (column.columnDef.meta || {}) as any
            return row.getCanExpand() ? (
              <DataGridExpander
                {...meta.expanderProps}
                isExpanded={row.getIsExpanded()}
                onToggle={row.getToggleExpandedHandler()}
              />
            ) : null
          },
          ...columnDef,
        } as ColumnDef<Data>,
      ]
    : []
}
