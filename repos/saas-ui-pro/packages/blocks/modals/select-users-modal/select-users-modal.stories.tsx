import React from 'react'

import { useDisclosure } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { Button } from '#registry/default/ui/button/button'
import type { PersonaPresence } from '#registry/default/ui/persona/presence'
import { toast } from '#registry/default/ui/toaster/toaster'

import { SelectListModal } from './select-users-modal'
import { UserPersona } from './user-persona'

export default {
  title: 'Blocks/Modals/SelectUsersModal',
} satisfies Meta

const users: Array<{
  id: number
  name: string
  email: string
  presence: PersonaPresence
}> = [
  {
    id: 1,
    name: 'Horace Torp',
    email: 'Esta.Gibson@gmail.com',
    presence: 'busy',
  },
  {
    id: 2,
    name: 'Louis Bosco',
    email: 'Trenton1@yahoo.com',
    presence: 'online',
  },
  {
    id: 3,
    name: 'Cory Bauch',
    email: 'Beau_Corwin27@hotmail.com',
    presence: 'offline',
  },
  {
    id: 4,
    name: 'Dr. Tyrone Parker',
    email: 'Johann_Schaden47@gmail.com',
    presence: 'busy',
  },
  {
    id: 5,
    name: 'Ora Ryan',
    email: 'Bernadine91@hotmail.com',
    presence: 'online',
  },
  {
    id: 6,
    name: 'Martin Koss IV',
    email: 'Hardy_Swanaiwski@yahoo.com',
    presence: 'busy',
  },
  {
    id: 7,
    name: 'Christian Dach',
    email: 'Emily.Adams@yahoo.com',
    presence: 'away',
  },
  {
    id: 8,
    name: 'Angel Pfeffer',
    email: 'Horacio_McLaughlin@yahoo.com',
    presence: 'dnd',
  },
  {
    id: 9,
    name: 'Kathryn DuBuque',
    email: 'Manuel22@yahoo.com',
    presence: 'offline',
  },
]

export const Default = () => {
  const { open, onOpen, onClose, setOpen } = useDisclosure({
    defaultOpen: true,
  })

  return (
    <>
      <Button onClick={onOpen}>Open Modal</Button>
      <SelectListModal
        items={users}
        renderItem={(user) => (
          <UserPersona
            key={user.id}
            name={user.name}
            email={user.email.toLowerCase()}
            presence={user.presence}
            size="sm"
          />
        )}
        filterFn={(item, query) => {
          const q = query.toLowerCase()
          return (
            item.name.toLowerCase().includes(q) ||
            item.email.toLowerCase().includes(q)
          )
        }}
        open={open}
        onOpenChange={({ open }) => {
          setOpen(open)
        }}
        title="Select users"
        description="Add or remove users from the project"
        onSubmit={(items) => {
          toast.info({
            title: `You selected ${items.length} users.`,
          })
          onClose()
        }}
        // These properties are only required for demo purposes
        preventScroll={false}
        trapFocus={false}
      />
    </>
  )
}
