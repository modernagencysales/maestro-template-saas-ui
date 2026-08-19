import * as React from 'react'

import { useDisclosure } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { Button } from '#registry/default/ui/button/button'

import { StoryCanvas } from '../../story-canvas.tsx'
import componentConfig from './component.config.ts'
import { InvitePeopleModal } from './invite-people-modal'

export default {
  title: 'Blocks/Modals/InvitePeopleModal',
  decorators: [
    (Story) => (
      <StoryCanvas {...componentConfig.canvas}>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta

export const Default = () => {
  const disclosure = useDisclosure({
    defaultOpen: true,
  })

  return (
    <>
      <Button onClick={disclosure.onOpen}>Invite people</Button>

      <InvitePeopleModal
        open={disclosure.open}
        onOpenChange={({ open }) => disclosure.setOpen(open)}
        onSubmit={async (data) => {
          console.log(data)
        }}
      />
    </>
  )
}
