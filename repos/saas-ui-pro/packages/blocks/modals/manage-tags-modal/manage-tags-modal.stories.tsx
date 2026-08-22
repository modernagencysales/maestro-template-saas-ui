import React, { useState } from 'react'

import { useDisclosure } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { Button } from '#registry/default/ui/button/button'

import type { Tag } from './manage-tags'
import { ManageTagsModal } from './manage-tags-modal'

export default {
  title: 'Blocks/Modals/ManageTagsModal',
} as Meta

const tagColors = [
  'red.solid',
  'orange.solid',
  'yellow.solid',
  'green.solid',
  'blue.solid',
  'indigo.solid',
  'purple.solid',
  'pink.solid',
]

export const Default = () => {
  const disclosure = useDisclosure({
    defaultOpen: true,
  })

  const [items, setItems] = useState<Tag[]>([
    {
      id: '1',
      name: 'Feature',
      count: 15,
      color: 'green.solid',
    },
    {
      id: '2',
      name: 'Javascript',
      count: 4,
      color: 'blue.solid',
    },
    {
      id: '3',
      name: 'Bug',
      count: 12,
      color: 'yellow.solid',
    },
    {
      id: '4',
      name: 'Beta',
      count: 14,
      color: 'red.solid',
    },
    {
      id: '5',
      name: 'Backend',
      count: 5,
      color: 'green.solid',
    },
    {
      id: '6',
      name: 'Design',
      count: 2,
      color: 'purple.solid',
    },
    {
      id: '7',
      name: 'UI',
      count: 6,
      color: 'red.solid',
    },
    {
      id: '8',
      name: 'Discussion',
      count: 54,
      color: 'gray.solid',
    },
  ])

  return (
    <>
      <Button onClick={disclosure.onOpen}>Manage tags</Button>

      <ManageTagsModal
        open={disclosure.open}
        onOpenChange={({ open }) => disclosure.setOpen(open)}
        colors={tagColors}
        items={items}
        onSave={async (item) => {
          setItems((items) => {
            const index = items.findIndex((i) => i.id === item.id)
            items[index] = item
            return [...items].sort((a, b) => a.name.localeCompare(b.name))
          })
        }}
        onCreate={async (item) => {
          const tag = {
            id: `${items.length + 1}`,
            name: item.name,
            count: 0,
            color: item.color,
          }
          setItems((items) =>
            [...items, tag].sort((a, b) => a.name.localeCompare(b.name)),
          )
        }}
        onDelete={async (id) => {
          setItems((items) => {
            const index = items.findIndex((i) => i.id === id)
            items.splice(index, 1)
            return [...items]
          })
        }}
        // // These properties are only required for demo purposes
        // blockScrollOnMount={false}
        // trapFocus={false}
      />
    </>
  )
}
