import { FormEvent, useState } from 'react'

import * as z from 'zod'
import { Icon, Text } from '@chakra-ui/react'
import { useDebouncedCallback, useSessionStorageValue } from '@react-hookz/web'
import { useMutation } from '@tanstack/react-query'
import { LuCheck, LuCircleX } from 'react-icons/lu'
import slug from 'slug'

import * as Steps from '#ui/steps/steps'
import { createOrganization } from '#api'
import { Form, useAppForm } from '#components/forms'
import { Spinner } from '#ui/spinner/spinner'
import { toast } from '#ui/toaster/toaster'

import { OnboardingStep } from './onboarding-step'

const schema = z.object({
  name: z
    .string()
    .min(1, 'Please enter your organization name.')
    .min(2, 'Please choose a name with at least 3 characters.')
    .max(50, 'The organization name should be no longer than 50 characters.')
    .describe('Name'),
  slug: z.string().regex(/^[a-z0-9-]+$/),
})

interface SlugValidationState {
  isValidSlug: boolean
  isPending: boolean
  isAvailable?: boolean
}

function SlugStatusIndicator({
  isValidSlug,
  isPending,
  isAvailable,
}: SlugValidationState) {
  if (isAvailable === undefined) {
    return null
  }

  if (!isValidSlug || isAvailable === false) {
    return <Icon as={LuCircleX} color="red.500" />
  }

  if (isPending) {
    return <Spinner size="xs" />
  }

  if (isAvailable) {
    return <Icon as={LuCheck} color="green.500" />
  }

  return null
}

export function CreateWorkspaceStep() {
  const stepper = Steps.useContext()

  const workspace = useSessionStorageValue('getting-started.workspace')

  const { mutateAsync } = useMutation({
    mutationFn: createOrganization,
  })

  const [slugValue, setSlugValue] = useState('')

  const slugAvailable = useMutation({
    mutationFn: async (args: { slug: string }) => ({
      available: true,
    }),
  })

  const checkSlug = useDebouncedCallback(slugAvailable.mutate, [], 500)

  const form = useAppForm({
    validators: { onSubmit: schema },
    defaultValues: {
      name: '',
      slug: '',
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await mutateAsync({
          name: value.name,
          slug: value.slug,
        })
        if (result?.createOrganization?.slug) {
          workspace.set(result.createOrganization.slug)
          stepper.goToNextStep()
        }
      } catch (error: any) {
        toast.error({
          title: 'Failed to create workspace',
          description: error.message,
        })
      }
    },
  })

  function handleSlugChange(value: string) {
    const slugValue = slug(value)
    setSlugValue(slugValue)
    form.setFieldValue('slug', slugValue)

    if (!schema.shape.slug.safeParse(slugValue).success) {
      slugAvailable.reset()
      return
    }

    checkSlug({ slug: slugValue })
  }

  const slugValidationState: SlugValidationState = {
    isValidSlug: schema.shape.slug.safeParse(slugValue).success,
    isPending: slugAvailable.isPending,
    isAvailable: slugAvailable.data?.available,
  }

  return (
    <Form form={form}>
      <OnboardingStep
        title="Create a new workspace"
        description="Saas UI is multi-tenant and supports workspaces."
        submitLabel="Create workspace"
        maxW="lg"
      >
        <form.Layout>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label="Workspace name"
                autoFocus
                required
                data-1p-ignore
                onChange={(e: FormEvent<HTMLInputElement>) =>
                  handleSlugChange(e.currentTarget.value)
                }
              />
            )}
          </form.AppField>
          <form.AppField name="slug">
            {(field) => (
              <field.TextField
                label="Workspace URL"
                startElement={
                  <Text color="fg.muted" pointerEvents="none" lineHeight="2">
                    {window.location.origin}/
                  </Text>
                }
                endElement={<SlugStatusIndicator {...slugValidationState} />}
                onChange={(e) => handleSlugChange(e.currentTarget.value)}
              />
            )}
          </form.AppField>
        </form.Layout>
      </OnboardingStep>
    </Form>
  )
}
