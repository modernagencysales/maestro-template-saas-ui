'use client'

import { Button, ButtonGroup, Spacer, Stack } from '@chakra-ui/react'
import { LuClock } from 'react-icons/lu'

import { ContactsViewPage } from '#features/contacts/view-page.tsx'

export function UpdatesPage(props: {
  params: {
    workspace: string
    id: string
  }
}) {
  const toolbar = (
    <ButtonGroup>
      <Spacer />
      <Button variant="surface" size="xs">
        Delete notification
      </Button>
      <Button variant="surface" size="xs">
        <LuClock /> Snooze
      </Button>
    </ButtonGroup>
  )
  return (
    <Stack bg="bg.panel" flex="1">
      <ContactsViewPage
        params={props.params}
        actions={toolbar}
        sidebarBreakpoint="xl"
      />
    </Stack>
  )
}
