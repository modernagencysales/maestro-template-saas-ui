'use client'

import { Button, ButtonGroup, Spacer, Stack } from '@chakra-ui/react'
import { LuClock } from 'react-icons/lu'

import { ContactPage } from '#features/contacts/view/contact-page'

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
      <ContactPage params={props.params} toolbarItems={toolbar} />
    </Stack>
  )
}
