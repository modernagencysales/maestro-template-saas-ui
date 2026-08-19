import { type HTMLChakraProps, chakra } from '@chakra-ui/react'
import type { Header } from '@tanstack/react-table'

import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '../../icons'
import { useDataGridContext } from './data-grid-context'

export interface DataGridSortProps<Data extends object, TValue>
  extends HTMLChakraProps<'span'> {
  header: Header<Data, TValue>
}
export const DataGridSort = <Data extends object, TValue>(
  props: DataGridSortProps<Data, TValue>,
) => {
  const { header, ...rest } = props

  const sorterStyles = {
    _focusVisible: {
      outline: 'none',
      boxShadow: 'outline',
    },
    ms: 2,
  }

  const { icons, translations } = useDataGridContext()

  const sortDescendingIcon = icons?.sortDescending ?? <ChevronDownIcon />
  const sortAscendingIcon = icons?.sortAscending ?? <ChevronUpIcon />
  const sortIcon = icons?.sort ?? <ChevronUpDownIcon />

  if (header.id === 'selection' || !header.column.getCanSort()) {
    return null
  }

  const sorted = header.column.getIsSorted()

  const isDesc = sorted === 'desc'

  return (
    <chakra.span
      fontSize="1.2em"
      display="inline-flex"
      alignItems="center"
      role="presentation"
      aria-label={
        isDesc ? translations.sortAscending : translations.sortDescending
      }
      {...rest}
      css={[sorterStyles, rest.css]}
    >
      {sorted ? (isDesc ? sortDescendingIcon : sortAscendingIcon) : sortIcon}
    </chakra.span>
  )
}

DataGridSort.displayName = 'DataGridSort'
