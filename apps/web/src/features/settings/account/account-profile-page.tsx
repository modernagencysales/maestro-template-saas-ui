'use client'

import { useRef, useState } from 'react'

import {
  Avatar,
  Card,
  Field,
  Group,
  Input,
  Section,
  Tooltip,
  toast,
} from '@saas-ui/react'

import { UserDTO } from '@workspace/api/types'
import { Form, useAppForm } from '@workspace/ui/form'
import { SettingsPage } from '@workspace/ui/settings-page'

import { useCurrentUser } from '#features/common/hooks/use-current-user'
import { api } from '#lib/trpc/react'

import { profileSchema } from './schema/profile.schema'

function ProfileDetails({ user }: { user: UserDTO }) {
  const utils = api.useUtils()

  const { mutateAsync } = api.users.updateProfile.useMutation({
    onSettled: () => {
      utils.auth.me.invalidate()
    },
    onSuccess: () => {
      toast.success({
        title: 'Profile updated',
      })
    },
    onError: () => {
      toast.error({
        title: 'Failed to update profile',
      })
    },
  })

  const form = useAppForm({
    validators: {
      onBlur: profileSchema,
      onSubmit: profileSchema,
    },
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
    },
    onSubmit: async ({ value }) => {
      await mutateAsync(value)
    },
  })

  return (
    <Section.Root>
      <Section.Header title="Basic details" />
      <Section.Body>
        <Card.Root>
          <Form form={form}>
            <Card.Body>
              <form.Layout labelWidth="142px">
                <ProfileAvatar user={user} />
                <form.AppField name="name">
                  {(field) => (
                    <field.TextField label="Name" orientation="horizontal" />
                  )}
                </form.AppField>
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField label="Email" orientation="horizontal" />
                  )}
                </form.AppField>
                <Group justify="end">
                  <form.SubmitButton>Save</form.SubmitButton>
                </Group>
              </form.Layout>
            </Card.Body>
          </Form>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  )
}

function ProfileAvatar({ user }: { user: UserDTO }) {
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()
  const ref = useRef<HTMLInputElement>(null)

  const selectFile = () => {
    ref.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files

    if (files?.[0]) {
      setPreviewUrl(URL.createObjectURL(files[0]))
    }
  }

  const avatarSrc = previewUrl ?? user.avatar ?? undefined

  return (
    <Field.Root orientation="horizontal">
      <Field.Label>Profile picture</Field.Label>
      <Tooltip content="Upload a picture">
        <Avatar
          name={user.name ?? undefined}
          src={avatarSrc}
          size="sm"
          onClick={selectFile}
          cursor="pointer"
        />
      </Tooltip>
      <Input type="file" ref={ref} onChange={handleFileChange} display="none" />
    </Field.Root>
  )
}

export function AccountProfilePage() {
  const [user] = useCurrentUser()

  return (
    <SettingsPage title="Profile">
      {user && <ProfileDetails user={user} />}
    </SettingsPage>
  )
}
