import * as React from 'react'

import * as Dialog from '#ui/dialog/dialog'
import { type FieldOptions, Form, useAppForm } from '#components/forms'

export interface InviteData {
  emails: string[]
  role?: 'admin' | 'member' | string
}

interface InviteInputs {
  emails: string
  role?: 'admin' | 'member' | string
}

export interface InviteDialogProps
  extends Omit<
    Dialog.RootProps,
    'onSubmit' | 'title' | 'scrollBehavior' | 'children'
  > {
  title?: string
  onInvite(data: InviteData): Promise<any>
  roles?: FieldOptions
  requiredLabel?: string
  placeholder?: string
  onError?: (error: any) => void
  defaultValues?: InviteInputs
}

export const defaultMemberRoles = [
  {
    value: 'admin',
    label: 'Admin',
  },
  {
    value: 'member',
    label: 'Member',
  },
]

export function InviteDialog(props: InviteDialogProps) {
  const {
    onOpenChange,
    onInvite,
    onError,
    roles,
    defaultValues,
    title = 'Invite people',
    placeholder = 'example@company.com, example2@company.com',
    requiredLabel = 'Add at least one email address.',
    ...rest
  } = props

  const fieldRef = React.useRef(null)

  const onSubmit = async ({ emails, role }: InviteInputs) => {
    try {
      await onInvite?.({
        emails: emails.split(',').map((email: string) => email.trim()),
        role,
      })

      onOpenChange?.({
        open: false,
      })
    } catch (e: any) {
      onError?.(e)
    }
  }

  const form = useAppForm({
    defaultValues: {
      emails: '',
      role: 'member',
      ...defaultValues,
    },
    onSubmit: ({ value }) => onSubmit(value),
  })

  const roleOptions = roles || defaultMemberRoles

  return (
    <Dialog.Root
      {...rest}
      onOpenChange={onOpenChange}
      initialFocusEl={() => fieldRef.current}
    >
      <Dialog.Content>
        <Form form={form}>
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <form.Layout>
              <form.AppField
                name="emails"
                validators={{
                  onSubmit: ({ value }) => (value ? undefined : requiredLabel),
                }}
              >
                {(field) => (
                  <field.TextareaField
                    placeholder={placeholder}
                    ref={fieldRef}
                  />
                )}
              </form.AppField>
              <form.AppField name="role">
                {(field) => (
                  <field.SelectField label="Role" options={roleOptions} />
                )}
              </form.AppField>
            </form.Layout>
          </Dialog.Body>
          <Dialog.Footer>
            <form.SubmitButton>Invite</form.SubmitButton>
          </Dialog.Footer>
        </Form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
