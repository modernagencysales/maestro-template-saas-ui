import type { HTMLChakraProps } from '@chakra-ui/react'

import { withContext } from './data-grid-context.tsx'

export interface DataGridRootProps extends HTMLChakraProps<'div'> {}

export const DataGridRoot = withContext<HTMLDivElement, DataGridRootProps>(
  'div',
  'root',
)

export interface DataGridScrollAreaProps extends HTMLChakraProps<'div'> {}

export const DataGridScrollArea = withContext<
  HTMLDivElement,
  DataGridScrollAreaProps
>('div', 'scrollArea')

export interface TableProps extends HTMLChakraProps<'table'> {}

export const Table = withContext<HTMLTableElement, TableProps>('table', 'table')

export interface TableRowProps extends HTMLChakraProps<'tr'> {}

export const TableRow = withContext<HTMLTableRowElement, TableRowProps>(
  'tr',
  'row',
)

export interface TableHeaderProps extends HTMLChakraProps<'thead'> {}

export const TableHeader = withContext<
  HTMLTableSectionElement,
  TableHeaderProps
>('thead', 'header')

export interface TableFooterProps extends HTMLChakraProps<'tfoot'> {}

export const TableFooter = withContext<
  HTMLTableSectionElement,
  TableFooterProps
>('tfoot', 'footer')

export interface TableColumnHeaderProps extends HTMLChakraProps<'th'> {}

export const TableColumnHeader = withContext<
  HTMLTableCellElement,
  TableColumnHeaderProps
>('th', 'columnHeader')

export interface TableCellProps extends HTMLChakraProps<'td'> {}

export const TableCell = withContext<HTMLTableCellElement, TableCellProps>(
  'td',
  'cell',
)

export interface TableCaptionProps extends HTMLChakraProps<'caption'> {}

export const TableCaption = withContext<
  HTMLTableCaptionElement,
  TableCaptionProps
>('caption', 'caption', {
  defaultProps: {
    captionSide: 'bottom',
  },
})

export interface TableBodyProps extends HTMLChakraProps<'tbody'> {}

export const TableBody = withContext<HTMLTableSectionElement, TableBodyProps>(
  'tbody',
  'body',
)

export interface TableColumnGroupProps extends HTMLChakraProps<'colgroup'> {}

export const TableColumnGroup = withContext<
  HTMLTableColElement,
  TableColumnGroupProps
>('colgroup')

export interface TableColumnProps extends HTMLChakraProps<'col'> {}

export const TableColumn = withContext<HTMLTableColElement, TableColumnProps>(
  'col',
)

export interface TableColumnTitleProps extends HTMLChakraProps<'div'> {}

export const TableColumnTitle = withContext<
  HTMLDivElement,
  TableColumnTitleProps
>('div', 'columnTitle')
