import React from 'react'

import { Box, HStack } from '@chakra-ui/react'
import {
  type DataGridCell,
  getDataGridFilter,
  useColumns,
} from '@saas-ui-pro/react'
import { format } from 'date-fns'
import Link from 'next/link'

import type { Contact } from '#api'
import { OverflowMenu } from '#components/overflow-menu/index.ts'
import { usePath } from '#features/common/hooks/use-path.ts'
import { Avatar } from '#ui/avatar/avatar'

import { ContactStatus } from './contact-status.tsx'
import { ContactTag } from './contact-tag.tsx'
import { ContactType } from './contact-type.tsx'

const DateCell = React.memo(function DateCell({ date }: { date?: string }) {
  return <>{date ? format(new Date(date), 'PP') : null}</>
})

const ActionCell: DataGridCell<Contact> = (cell) => {
  return (
    <Box onClick={(e) => e.stopPropagation()}>
      <OverflowMenu.Root lazyMount portalled>
        <OverflowMenu.Item
          value="delete"
          onClick={() => console.log(cell.row.id)}
        >
          Delete
        </OverflowMenu.Item>
      </OverflowMenu.Root>
    </Box>
  )
}

export function useContactsColumns() {
  const basePath = usePath()

  return useColumns<Contact>(
    (helper) => [
      helper.accessor('name', {
        header: 'Name',
        size: 200,
        enableHiding: false,
        cell: (cell) => (
          <HStack gap="4">
            <Avatar
              name={cell.getValue()}
              src={cell.row.original.avatar}
              size="xs"
            />
            <Link href={`${basePath}/contacts/view/${cell.row.id}`}>
              {cell.getValue()}
            </Link>
          </HStack>
        ),
      }),
      helper.accessor('email', {
        header: 'Email',
        size: 300,
        meta: {
          cellProps: {
            color: 'fg.muted',
          },
        },
      }),
      helper.accessor('createdAt', {
        header: 'Created at',
        cell: (cell) => <DateCell date={cell.getValue()} />,
        filterFn: getDataGridFilter('date'),
        enableGlobalFilter: false,
      }),
      helper.accessor('updatedAt', {
        header: 'Updated at',
        cell: (cell) => <DateCell date={cell.getValue()} />,
        filterFn: getDataGridFilter('date'),
        enableGlobalFilter: false,
      }),
      helper.accessor('type', {
        header: 'Type',
        cell: (cell) => <ContactType type={cell.getValue()} />,
        filterFn: getDataGridFilter('string'),
        enableGlobalFilter: false,
      }),
      helper.accessor('tags', {
        header: 'Tags',
        cell: (cell) => (
          <HStack>
            {cell.getValue()?.map((tag) => (
              <ContactTag key={tag} tag={tag} />
            ))}
          </HStack>
        ),
        filterFn: getDataGridFilter('string'),
        enableGlobalFilter: false,
      }),
      helper.accessor('status', {
        header: 'Status',
        cell: (cell) => (
          <ContactStatus status={cell.getValue()} color="fg.muted" />
        ),
        filterFn: getDataGridFilter('string'),
        enableGlobalFilter: false,
      }),
      helper.display({
        id: 'action',
        header: '',
        cell: ActionCell,
        size: 60,
        enableGlobalFilter: false,
        enableHiding: false,
        enableSorting: false,
        enableGrouping: false,
        enableResizing: false,
      }),
    ],
    [],
  )
}
