import { Button, Dialog, toast } from '@saas-ui/react'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { Form, useAppForm } from '@workspace/ui/form'

import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'
import { api } from '#lib/trpc/react'

const schema = z.object({
  name: z
    .string()
    .min(2, 'Please enter a name')
    .max(255, 'Name can be at most 255 characters long')
    .describe('Full name'),
  email: z.string().email().describe('Email'),
})

export interface AddPersonDialogProps extends Omit<
  Dialog.RootProps,
  'children'
> {
  type: 'lead' | 'customer'
}

export function AddPersonDialog(props: AddPersonDialogProps) {
  const navigate = useNavigate()

  const [workspace] = useCurrentWorkspace()

  const utils = api.useUtils()

  const createContactMutation = api.contacts.create.useMutation({
    onSettled: () => {
      utils.contacts.listByType.invalidate({ workspaceId: workspace.id })
    },
    onSuccess: (data) => {
      toast.success({
        title: 'Person added',
        action: {
          label: 'View person',
          onClick: () => {
            navigate({
              to: '/$workspace/contacts/view/$id',
              params: {
                workspace: workspace.id,
                id: data!.id,
              },
            })
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
    validators: {
      onSubmit: schema,
    },
    defaultValues: {
      name: '',
      email: '',
    },
    onSubmit: async ({ value }) => {
      await createContactMutation.mutateAsync({
        name: value.name,
        workspaceId: workspace.id,
        type: props.type,
        email: value.email,
      })
    },
  })

  return (
    <Dialog.Root {...props}>
      <Dialog.Content>
        <Form form={form}>
          <Dialog.Header>
            <Dialog.Title>Add person</Dialog.Title>
            <Dialog.CloseButton />
          </Dialog.Header>
          <Dialog.Body>
            <form.Layout>
              <form.AppField name="name">
                {(field) => <field.TextField label="Name" />}
              </form.AppField>
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
            <Dialog.ActionTrigger asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.ActionTrigger>
            <form.SubmitButton>Add</form.SubmitButton>
          </Dialog.Footer>
        </Form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
