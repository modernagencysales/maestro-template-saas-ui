import type { Header, Table } from '@tanstack/react-table'

import { dataAttr } from '../../utils/dom'
import { runIfFn } from '../../utils/run-if-fn'
import { DataGridHeaderCell } from './data-grid-header-cell'
import { TableHeader, TableRow } from './data-grid-primitives.tsx'
import type { DataGridColumnVirtualizer } from './data-grid-virtualizer'
import type { DataGridSlotProps } from './data-grid.types'

export interface DataGridHeaderProps<Data extends object> {
  instance: Table<Data>
  columnVirtualizer?: DataGridColumnVirtualizer | null
  stickyHeader: boolean
  slotProps?: DataGridSlotProps<Data>
  isSortable?: boolean
}

export function DataGridHeader<Data extends object>(
  props: DataGridHeaderProps<Data>,
) {
  const { instance, columnVirtualizer, stickyHeader, slotProps, isSortable } =
    props

  const virtualColumns = columnVirtualizer?.getVirtualItems()

  return (
    <TableHeader data-sticky={dataAttr(stickyHeader)}>
      {instance.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {columnVirtualizer?.virtualPaddingLeft ? (
            <th
              style={{
                display: 'flex',
                width: columnVirtualizer.virtualPaddingLeft,
              }}
            />
          ) : null}
          {(virtualColumns ?? headerGroup.headers).map(
            (headerOrVirtualColumn, index) => {
              let header = headerOrVirtualColumn as unknown as Header<
                Data,
                unknown
              >
              if (columnVirtualizer) {
                header = headerGroup.headers[headerOrVirtualColumn.index]
                index = headerOrVirtualColumn.index
              }

              const headerProps = runIfFn(slotProps?.header, {
                header,
                table: instance,
              })

              const key = `${header.id}-${index}`

              return (
                <DataGridHeaderCell
                  key={key}
                  header={header}
                  isSortable={isSortable}
                  {...headerProps}
                />
              )
            },
          )}
          {columnVirtualizer?.virtualPaddingRight ? (
            <th
              style={{
                display: 'flex',
                width: columnVirtualizer.virtualPaddingRight,
              }}
            />
          ) : null}
        </TableRow>
      ))}
    </TableHeader>
  )
}
