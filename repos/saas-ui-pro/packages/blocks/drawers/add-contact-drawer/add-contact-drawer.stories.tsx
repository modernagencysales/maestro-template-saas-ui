import * as React from 'react'

import { useDisclosure } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { Button } from '#registry/default/ui/button/button'

import {
  AddContactDrawer,
  type AddContactFormValues,
} from './add-contact-drawer'

export default {
  title: 'Blocks/Drawers/AddContactDrawer',
} satisfies Meta

export const Default = () => {
  const disclosure = useDisclosure({
    defaultOpen: true,
  })

  const onSubmit = (data: AddContactFormValues) => {
    console.log(data)
  }

  return (
    <>
      <Button onClick={disclosure.onOpen}>Add contact</Button>
      <AddContactDrawer
        open={disclosure.open}
        onOpenChange={({ open }) => disclosure.setOpen(open)}
        preventScroll={false}
        onSubmit={onSubmit}
      />
    </>
  )
}
