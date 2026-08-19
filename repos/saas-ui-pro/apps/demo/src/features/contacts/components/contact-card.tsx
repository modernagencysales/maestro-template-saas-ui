import React from 'react'

import { Card, HStack, Heading, Stack, Text } from '@chakra-ui/react'
import Link from 'next/link'

import { Contact } from '#api'
import { useDataBoardContext } from '#components/data-board'
import { usePath } from '#features/common/hooks/use-path'
import { Persona } from '#ui/persona'

import { ContactStatus } from './contact-status'
import { ContactTag } from './contact-tag'
import { ContactType } from './contact-type'

export const ContactCard = ({ contact }: { contact: Contact }) => {
  const path = usePath(`/contacts/view/${contact.id}`)

  const grid = useDataBoardContext()

  const state = grid.getState()
  const columns = state.columnVisibility
  const groupBy = state.grouping[0]

  const renderColumn = React.useCallback(
    (column: string, component: React.ReactNode) => {
      if (columns[column] && groupBy != column) {
        return component
      }
      return null
    },
    [columns],
  )

  const tags = typeof contact.tags === 'string' ? [contact.tags] : contact.tags

  return (
    <Card.Root
      position="relative"
      w="full"
      userSelect="none"
      _hover={{
        textDecoration: 'none',
        bg: 'bg.muted',
      }}
      css={{
        WebkitUserDrag: 'none',
      }}
      textStyle="sm"
      asChild
    >
      <Link
        href={path}
        prefetch={
          false
        } /* This is a performance optimization to make sure Next.js doesn't start prefetching 100s of contacts */
      >
        <Card.Body gap="4" position="relative">
          <Stack justifyContent="flex-start" gap="2">
            <Stack gap="1">
              <HStack>
                {renderColumn(
                  'status',
                  <ContactStatus
                    status={contact.status}
                    hideLabel
                    position="absolute"
                    top="4"
                    right="4"
                  />,
                )}
                <Persona.Root size="2xs">
                  <Persona.Avatar name={contact.name} src={contact.avatar} />
                </Persona.Root>
                <Heading as="h4" size="2xs" fontWeight="medium">
                  {contact.name}
                </Heading>
              </HStack>
              {renderColumn(
                'email',
                <Text color="muted" lineClamp={1}>
                  {contact.email}
                </Text>,
              )}
            </Stack>
          </Stack>
          <HStack gap="1">
            {renderColumn(
              'type',
              <ContactType type={contact.type} size="sm" />,
            )}
            {renderColumn(
              'tags',
              tags?.map((tag) => <ContactTag key={tag} tag={tag} size="sm" />),
            )}
          </HStack>
        </Card.Body>
      </Link>
    </Card.Root>
  )
}
