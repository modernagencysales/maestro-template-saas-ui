'use client'

import { Card, Group } from '@chakra-ui/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import * as Section from '#ui/section/section'
import { Organization, getOrganization, updateOrganization } from '#api'
import { Form, useAppForm } from '#components/forms'
import { SettingsPage } from '#components/settings-page'
import { useWorkspace } from '#features/common/hooks/use-workspace'
import { toast } from '#ui/toaster/toaster'

const schema = z.object({
  name: z.string().min(2, 'Too short').max(25, 'Too long').describe('Name'),
  email: z
    .string()
    .email({ message: 'Please enter your email address' })
    .describe('Email'),
})

interface OrganizationDetailsProps {
  organization: Organization
}

function OrganizationDetails({ organization }: OrganizationDetailsProps) {
  const { isPending, mutateAsync } = useMutation({
    mutationFn: updateOrganization,
    onSuccess: () => {
      toast.success({
        title: 'Updated the organization',
      })
    },
  })

  const form = useAppForm({
    validators: { onSubmit: schema },
    defaultValues: {
      name: organization.name,
      email: organization.email,
    },
    onSubmit: ({ value }) => {
      return mutateAsync({
        id: organization.id,
        name: value.name,
      }).then(() =>
        toast.success({
          title: 'Updated the organization',
        }),
      )
    },
  })

  return (
    <Section.Root>
      <Section.Header title="Organization details" />
      <Section.Body>
        <Card.Root>
          <Form form={form}>
            <Card.Body css={{ '--field-label-width': '10rem' }}>
              <form.Layout>
                <form.AppField name="name">
                  {(field) => (
                    <field.TextField
                      orientation="horizontal"
                      label="Organization name"
                    />
                  )}
                </form.AppField>
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      type="email"
                      orientation="horizontal"
                      label="Email address"
                    />
                  )}
                </form.AppField>
                <Group ps="calc(var(--field-label-width) + var(--chakra-spacing-2))">
                  <form.SubmitButton />
                </Group>
              </form.Layout>
            </Card.Body>
          </Form>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  )
}

export function OrganizationSettingsPage() {
  const slug = useWorkspace()

  const { data, isLoading } = useQuery({
    queryKey: ['Organization', slug],
    queryFn: () => getOrganization({ slug }),
  })

  const organization = data?.organization

  return (
    <SettingsPage
      loading={isLoading}
      title="Organization"
      description="Manage your organization settings"
    >
      {organization && <OrganizationDetails organization={organization} />}
    </SettingsPage>
  )
}
