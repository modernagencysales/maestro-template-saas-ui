import { SimpleGrid } from '@chakra-ui/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import * as Dialog from '#ui/dialog/dialog'
import { createContact } from '#api'
import { Form, useAppForm } from '#components/forms'
import { usePath } from '#features/common/hooks/use-path.ts'
import { toast } from '#ui/toaster/toaster'

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
})

export function AddPersonDialog(props: Dialog.RootProps) {
  const router = useRouter()

  const basePath = usePath()

  const createContactMutation = useMutation({
    mutationFn: createContact,
    onSuccess: ({ createContact }) => {
      toast.success({
        title: 'Person added',
        action: {
          label: 'View person',
          onClick: () => {
            router.push(`${basePath}/contacts/${createContact.id}`)
          },
        },
      })
    },
    onError: (error) => {
      console.error(error)
      toast.error({
        title: 'Failed to add person',
      })
    },
  })

  const form = useAppForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await createContactMutation.mutateAsync(value)
    },
  })

  return (
    <Dialog.Root {...props}>
      <Dialog.Content>
        <Form form={form}>
          <Dialog.Header>
            <Dialog.Title>Add person</Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>
          <Dialog.Body>
            <form.Layout>
              <SimpleGrid columns={2} gap="4">
                <form.AppField name="firstName">
                  {(field) => <field.TextField label="First name" />}
                </form.AppField>
                <form.AppField name="lastName">
                  {(field) => <field.TextField label="Last name" />}
                </form.AppField>
              </SimpleGrid>
              <form.AppField name="email">
                {(field) => (
                  <field.TextField
                    label="Email"
                    type="email"
                    placeholder="john@doe.com"
                  />
                )}
              </form.AppField>
            </form.Layout>
          </Dialog.Body>
          <Dialog.Footer>
            <form.SubmitButton>Add</form.SubmitButton>
          </Dialog.Footer>
        </Form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
