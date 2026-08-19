import { forwardRef } from 'react'

import {
  DataGrid,
  DataGridPagination,
  type DataGridProps,
  NoFilteredResults,
  type Row,
} from '@saas-ui-pro/react'

import type { Contact } from '#api'

import { useContactsColumns } from './use-contacts-columns.tsx'

export interface ContactsGridProps
  extends Pick<
    DataGridProps<Contact>,
    | 'data'
    | 'initialState'
    | 'state'
    | 'onSortChange'
    | 'onSelectedRowsChange'
    | 'onFocusChange'
    | 'onColumnFiltersChange'
  > {}

export const ContactsGrid = forwardRef<HTMLTableElement, ContactsGridProps>(
  function ContactsGrid(props, ref) {
    const columns = useContactsColumns()

    return (
      <DataGrid<Contact>
        ref={ref}
        // instanceRef={gridRef}
        columns={columns}
        data={props.data}
        initialState={props.initialState}
        state={props.state}
        isSelectable
        isSortable
        isHoverable
        stickyHeader
        columnResizeEnabled
        noResults={NoFilteredResults}
        manualSorting={!!props.onSortChange}
        getRowId={(data) => data.id}
        onRowClick={(row: Row<Contact>, e: React.MouseEvent) => {
          const link: HTMLAnchorElement | null =
            e.currentTarget.querySelector('td a')
          link?.click()
        }}
        columnVirtualizerOptions={{
          enabled: false,
        }}
        rowVirtualizerOptions={{
          enabled: false,
        }}
      >
        <DataGridPagination.Root siblingCount={3} borderTopWidth="1px">
          <DataGridPagination.PageControl />
          <DataGridPagination.PreviousButton />
          <DataGridPagination.Items />
          <DataGridPagination.NextButton />
        </DataGridPagination.Root>
      </DataGrid>
    )
  },
)
