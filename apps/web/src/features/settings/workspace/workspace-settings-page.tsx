'use client'

import { useRef, useState } from 'react'

import { useDebouncedCallback } from '@react-hookz/web'
import {
  Avatar,
  Card,
  Field,
  Icon,
  Input,
  Section,
  Spinner,
  Text,
  Tooltip,
  toast,
} from '@saas-ui/react'
import { LuCheck } from 'react-icons/lu'
import slug from 'slug'
import { z } from 'zod'

import type { WorkspaceDTO } from '@workspace/api/types'
import { Form, useAppForm } from '@workspace/ui/form'
import { SettingsPage } from '@workspace/ui/settings-page'

import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'
import { api } from '#lib/trpc/react'

const schema = z.object({
  name: z
    .string()
    .min(1, 'Please enter your workspace name.')
    .min(2, 'Please choose a name with at least 3 characters.')
    .max(50, 'The name should be no longer than 50 characters.')
    .describe('Name'),
  slug: z
    .string()
    .min(1, 'Please enter your workspace URL.')
    .min(2, 'Please choose an URL with at least 3 characters.')
    .max(50, 'The URL should be no longer than 50 characters.')
    .regex(
      /^[a-z0-9-]+$/,
      'The URL should only contain lowercase letters, numbers, and dashes.',
    )
    .describe('Slug'),
  logo: z.string().optional().describe('Logo'),
})

function WorkspaceDetails(props: { workspace: WorkspaceDTO }) {
  const { workspace } = props

  const { mutateAsync } = api.workspaces.update.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate()
      utils.workspaces.bySlug.invalidate()

      toast.success({
        title: 'Workspace updated',
        description: 'Your workspace settings have been updated.',
      })
    },
  })

  const utils = api.useUtils()

  const setSlugError = (message: string | undefined) => {
    form.setFieldMeta('slug', (prev) => ({
      ...prev,
      errorMap: { ...prev.errorMap, onServer: message },
    }))
  }

  const slugAvailable = api.workspaces.slugAvailable.useMutation({
    onSettled: (data) => {
      setSlugError(
        data?.available ? undefined : 'This workspace URL is already taken.',
      )
    },
  })

  const checkSlug = useDebouncedCallback(slugAvailable.mutate, [], 500)

  const setSlug = (value: string) => {
    const slugValue = slug(value)
    form.setFieldValue('slug', slugValue)

    if (!slugValue.trim()) {
      setSlugError('Slug is required')
    } else if (slugValue !== workspace.slug) {
      checkSlug({ slug: slugValue })
    }
  }

  const form = useAppForm({
    validators: {
      onBlur: schema,
      onSubmit: schema,
    },
    defaultValues: {
      name: workspace.name,
      slug: workspace.slug,
    },
    onSubmit: async ({ value }) => {
      await mutateAsync({
        workspaceId: workspace.id,
        name: value.name,
        slug: value.slug,
      })
    },
  })

  return (
    <Section.Root>
      <Section.Header>
        <Section.Title>Workspace details</Section.Title>
      </Section.Header>
      <Section.Body>
        <Card.Root>
          <Form form={form}>
            <Card.Body>
              <form.Layout labelWidth="10rem">
                <WorkspaceLogo workspace={workspace} />
                <form.AppField name="name">
                  {(field) => (
                    <field.TextField
                      label="Workspace name"
                      orientation="horizontal"
                    />
                  )}
                </form.AppField>
                <form.AppField name="slug">
                  {(field) => (
                    <field.TextField
                      type="text"
                      label="Workspace URL"
                      orientation="horizontal"
                      ps="134px"
                      startElement={
                        <Text color="fg.muted" textStyle="sm">
                          https://saas-ui.dev/
                        </Text>
                      }
                      endElement={
                        slugAvailable.isPending ? (
                          <Spinner size="xs" />
                        ) : slugAvailable.data?.available ? (
                          <Icon
                            as={LuCheck}
                            color="green.500"
                            strokeWidth="3"
                          />
                        ) : null
                      }
                      onChange={(e) => {
                        const value = e.currentTarget.value
                        setSlug(value)
                      }}
                    />
                  )}
                </form.AppField>
                <form.Footer>
                  <form.SubmitButton>Update</form.SubmitButton>
                </form.Footer>
              </form.Layout>
            </Card.Body>
          </Form>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  )
}

// TODO add s3 uploads
function WorkspaceLogo(props: { workspace: WorkspaceDTO }) {
  const { workspace } = props
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

  const avatarSrc = previewUrl ?? workspace.logo ?? undefined

  return (
    <Field.Root orientation="horizontal">
      <Field.Label>Workspace logo</Field.Label>
      <Tooltip content="Upload a logo">
        <Avatar
          name={workspace.name ?? undefined}
          src={avatarSrc}
          size="sm"
          onClick={selectFile}
          cursor="pointer"
        />
      </Tooltip>
      <Field.HelperText>Recommended size: 200x200px</Field.HelperText>
      <Input type="file" ref={ref} onChange={handleFileChange} display="none" />
    </Field.Root>
  )
}

export function WorkspaceSettingsPage() {
  const [workspace] = useCurrentWorkspace()

  return (
    <SettingsPage title="Workspace">
      <WorkspaceDetails workspace={workspace} />
    </SettingsPage>
  )
}
