import { Box } from '@chakra-ui/react'
import { type DataGridProps, NoFilteredResults } from '@saas-ui-pro/react'
import { useMutation } from '@tanstack/react-query'

import { type Contact, updateContact } from '#api'
import { DataBoard } from '#components/data-board/data-board.tsx'

import { ContactBoardHeader } from './contact-board-header.tsx'
import { ContactCard } from './contact-card.tsx'
import { useContactsColumns } from './use-contacts-columns.tsx'

export interface ContactsBoardProps
  extends Pick<DataGridProps<Contact>, 'data' | 'initialState' | 'state'> {}

export function ContactsBoard(props: ContactsBoardProps) {
  const { data, initialState, state } = props

  const columns = useContactsColumns()

  const updateContactMutation = useMutation({
    mutationFn: (contact: Partial<Contact> & { id: string }) =>
      updateContact(contact),
  })

  return (
    <Box height="100%" width="100%">
      <DataBoard
        columns={columns}
        data={data}
        groupBy="status"
        initialState={initialState}
        state={state}
        noResults={NoFilteredResults}
        getRowId={(row) => row.id}
        renderHeader={(header) => <ContactBoardHeader {...header} />}
        renderCard={(row) => <ContactCard contact={row.original} />}
        px="6"
        height="100%"
        onCardDragEnd={({ items, to, from }) => {
          // This is a bare minimum example, you likely need more logic for updating the sort order and changing tags.

          // Get the contact data
          const contact = data?.find(
            ({ id }) => id === items[to.columnId][to.index],
          )

          const [field, toValue] = (to.columnId as string).split(':') as [
            keyof Contact,
            string,
          ]
          const [, prevValue] = (from.columnId as string).split(':')

          if (!contact) {
            throw new Error('Contact not found')
          }

          const prevId = items[to.columnId][to.index - 1]
          let prevContact = data.find(({ id }) => id === prevId)

          const nextId = items[to.columnId][to.index + 1]
          let nextContact = data.find(({ id }) => id === nextId)

          if (prevContact && !nextContact) {
            // last in the column
            nextContact = data[data.findIndex(({ id }) => id === prevId) + 1]
          } else if (!prevContact && !nextContact) {
            // first in the column
            prevContact = data[data.findIndex(({ id }) => id === prevId) - 1]
          }

          const prevSortOrder = prevContact?.sortOrder || 0
          const nextSortOrder = nextContact?.sortOrder || data.length || 0

          const sortOrder = (prevSortOrder + nextSortOrder) / 2 || to.index

          let value: string | string[] = toValue
          // if the field is an array, we replace the old value
          if (Array.isArray(contact[field])) {
            value = (value !== '' ? [value] : []).concat(
              (contact[field] as string[]).filter((v) => v !== prevValue),
            )
          }

          updateContactMutation.mutateAsync({
            id: contact.id,
            [field]: value,
            sortOrder,
          })
        }}
      />
    </Box>
  )
}
