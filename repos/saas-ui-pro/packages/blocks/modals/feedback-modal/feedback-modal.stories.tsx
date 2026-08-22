import { useDisclosure } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { Button } from '#registry/default/ui/button/button'
import { toast } from '#registry/default/ui/toaster/toaster'

import { FeedbackModal } from './feedback-modal'

export default {
  title: 'Blocks/Modals/FeedbackModal',
  decorators: [(Story) => <Story />],
} satisfies Meta

export const Default = () => {
  const disclosure = useDisclosure({
    defaultOpen: true,
  })

  return (
    <>
      <Button variant="solid" onClick={disclosure.onOpen}>
        Submit feedback
      </Button>
      <FeedbackModal
        open={disclosure.open}
        onOpenChange={({ open }) => disclosure.setOpen(open)}
        onSubmit={(data) => {
          console.log(data)

          disclosure.onClose()
          toast.success({
            title: 'Feedback submitted',
            description: 'Thank you, your feedback has been submitted.',
          })
        }}
        // These props are only required for demo purposes
        preventScroll={false}
        trapFocus={false}
      />
    </>
  )
}
