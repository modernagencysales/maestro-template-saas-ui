import { useMemo } from 'react'

import { type Table, flexRender } from '@tanstack/react-table'

import { dataAttr } from '../../utils/dom'
import { runIfFn } from '../../utils/run-if-fn'
import { TableCell, TableFooter, TableRow } from './data-grid-primitives.tsx'
import { type DataGridColumnVirtualizer } from './data-grid-virtualizer'
import type { DataGridSlotProps } from './data-grid.types'
import { escapeId } from './data-grid.utils'
import { getPinnedStyles, isGroupColumn } from './utils'

export interface DataGridFooterProps<Data extends object> {
  instance: Table<Data>
  slotProps?: DataGridSlotProps<Data>
  columnVirtualizer?: DataGridColumnVirtualizer | null
  stickyFooter?: boolean
}

export function DataGridFooter<Data extends object>(
  props: DataGridFooterProps<Data>,
) {
  const { instance, slotProps, columnVirtualizer, stickyFooter } = props

  const footerGroups = instance.getFooterGroups()

  const hasFooter = useMemo(
    () =>
      footerGroups.some((footerGroup) =>
        footerGroup.headers.some(
          (header) => !header.isPlaceholder && header.column.columnDef.footer,
        ),
      ),
    [footerGroups],
  )

  if (!hasFooter) return null

  const virtualColumns = columnVirtualizer?.getVirtualItems()

  return (
    <TableFooter>
      {footerGroups.map((footerGroup) => {
        const headers = virtualColumns ?? footerGroup.headers

        return (
          <TableRow key={footerGroup.id}>
            {columnVirtualizer?.virtualPaddingLeft ? (
              <th
                style={{
                  display: 'flex',
                  width: columnVirtualizer.virtualPaddingLeft,
                }}
              />
            ) : null}
            {headers.map((vc) => {
              const header = 'column' in vc ? vc : footerGroup.headers[vc.index]

              const colId = escapeId(header.id)

              const footerProps = runIfFn(slotProps?.footer, {
                header,
                table: instance,
              })

              const column = header.column

              const isColumnPinned =
                !isGroupColumn(column) && column.getIsPinned()
              const isFirst = column.getIsFirstColumn(isColumnPinned)
              const isLast = column.getIsLastColumn(isColumnPinned)

              const headerStyle = getPinnedStyles(column)

              return (
                <TableCell
                  key={header.id}
                  data-pinned={isColumnPinned ? isColumnPinned : undefined}
                  data-first={dataAttr(isFirst)}
                  data-last={dataAttr(isLast)}
                  flex={`1 0 calc(var(--col-${colId}-size) * 1px)`}
                  width={`calc(var(--col-${colId}-size) * 1px)`}
                  minWidth={`max(var(--col-${colId}-size) * 1px, 40px)`}
                  {...footerProps}
                  style={{
                    ...headerStyle,
                    ...footerProps?.style,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.footer,
                        header.getContext(),
                      )}
                </TableCell>
              )
            })}
            {columnVirtualizer?.virtualPaddingRight ? (
              <th
                style={{
                  display: 'flex',
                  width: columnVirtualizer.virtualPaddingRight,
                }}
              />
            ) : null}
          </TableRow>
        )
      })}
    </TableFooter>
  )
}
