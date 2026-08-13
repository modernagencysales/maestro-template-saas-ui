import React from 'react'

import { Card, HStack, Heading, Stack, Text } from '@saas-ui/react'
import { createLink } from '@tanstack/react-router'

import { ContactDTO } from '@workspace/api/types'
import { useDataBoardContext } from '@workspace/ui/data-board'

import { useWorkspaceSlug } from '#features/common/hooks/use-workspace-slug'

import { ContactAvatar } from '../common/contact-avatar'
import { ContactStatus } from '../common/contact-status'
import { ContactTag } from '../common/contact-tag'
import { ContactType } from '../common/contact-type'

export const ContactCard = ({ contact }: { contact: ContactDTO }) => {
  const workspace = useWorkspaceSlug()
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
    [columns, groupBy],
  )

  const tags = typeof contact.tags === 'string' ? [contact.tags] : contact.tags

  return (
    <CardLink
      to="/$workspace/contacts/view/$id"
      params={{
        workspace,
        id: contact.id,
      }}
      position="relative"
      w="full"
      userSelect="none"
      _hover={{
        textDecoration: 'none',
        bg: 'gray.50',
        _dark: {
          bg: 'whiteAlpha.100',
        },
      }}
      css={{
        WebkitUserDrag: 'none',
      }}
    >
      <Card.Body as={Stack} gap="4" position="relative">
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
              <ContactAvatar contact={contact} size="2xs" />
              <Heading as="h4" size="xs" fontWeight="medium">
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
        <HStack>
          {renderColumn('type', <ContactType type={contact.type} size="sm" />)}
          {renderColumn(
            'tags',
            tags?.map((tag) => <ContactTag key={tag} tag={tag} size="sm" />),
          )}
        </HStack>
      </Card.Body>
    </CardLink>
  )
}

const CardLink = createLink(Card.Root)
