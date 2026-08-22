'use client'

import { useRef, useState } from 'react'

import { Button, Card, Field, Group, Input } from '@chakra-ui/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import * as Section from '#ui/section/section'
import { User, getCurrentUser, updateUser } from '#api'
import { Form, useAppForm } from '#components/forms'
import { SettingsPage } from '#components/settings-page'
import { Avatar } from '#ui/avatar/avatar'
import { toast } from '#ui/toaster/toaster'
import { Tooltip } from '#ui/tooltip/tooltip'

const schema = z.object({
  firstName: z
    .string()
    .min(2, 'Too short')
    .max(25, 'Too long')
    .describe('First name'),
  lastName: z
    .string()
    .min(2, 'Too short')
    .max(25, 'Too long')
    .describe('Last name'),
  email: z
    .string()
    .email({ message: 'Please enter your email address' })
    .describe('Email'),
})

function ProfileDetails({ user }: { user: User }) {
  const { isPending, mutateAsync } = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      toast.success({
        title: 'Profile updated',
      })
    },
  })

  const form = useAppForm({
    validators: { onSubmit: schema },
    defaultValues: {
      firstName: user?.firstName,
      lastName: user?.lastName,
      email: user?.email,
    },
    onSubmit: ({ value }) => {
      return mutateAsync({
        id: user.id,
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
      })
    },
  })

  return (
    <Section.Root>
      <Section.Body>
        <Card.Root>
          <Form form={form}>
            <Card.Body>
              <form.Layout css={{ '--field-label-width': '142px' }}>
                <ProfileAvatar user={user} />
                <form.AppField name="firstName">
                  {(field) => (
                    <field.TextField
                      label="First name"
                      orientation="horizontal"
                    />
                  )}
                </form.AppField>
                <form.AppField name="lastName">
                  {(field) => (
                    <field.TextField
                      label="Last name"
                      orientation="horizontal"
                    />
                  )}
                </form.AppField>
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      label="Email"
                      type="email"
                      orientation="horizontal"
                    />
                  )}
                </form.AppField>
                <Group ps="calc(var(--field-label-width) + var(--chakra-spacing-1\.5))">
                  <Button variant="surface" type="submit" loading={isPending}>
                    Save
                  </Button>
                </Group>
              </form.Layout>
            </Card.Body>
          </Form>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  )
}

function ProfileAvatar({ user }: { user: User }) {
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()
  const ref = useRef<HTMLInputElement>(null)

  const selectFile = () => {
    ref.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files

    if (files?.length) {
      setPreviewUrl(URL.createObjectURL(files[0]))
    }
  }

  return (
    <Field.Root orientation="horizontal">
      <Field.Label>Profile picture</Field.Label>
      <Tooltip content="Upload a picture">
        <Avatar
          name={user.name}
          src={previewUrl || user.avatar}
          size="md"
          onClick={selectFile}
          cursor="pointer"
        />
      </Tooltip>
      <Input type="file" ref={ref} onChange={handleFileChange} display="none" />
    </Field.Root>
  )
}

export function AccountProfilePage() {
  const { isLoading, data } = useQuery({
    queryKey: ['CurrentUser'],
    queryFn: getCurrentUser,
  })

  const user = data?.currentUser

  return (
    <SettingsPage
      title="Profile"
      description="Manage your profile"
      loading={isLoading}
    >
      {user && <ProfileDetails user={user} />}
    </SettingsPage>
  )
}
