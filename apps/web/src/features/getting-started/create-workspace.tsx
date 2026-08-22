import { Icon, Spinner, Text, useStepsContext } from '@chakra-ui/react'
import { useDebouncedCallback, useSessionStorageValue } from '@react-hookz/web'
import { toast } from '@saas-ui/react'
import { LuCheck, LuCircleX } from 'react-icons/lu'
import slug from 'slug'

import { Form, useAppForm } from '@workspace/ui/form'

import { getBaseUrl } from '#features/common/util/get-base-url'
import { api } from '#lib/trpc/react'

import { OnboardingStep } from './onboarding-step'
import { workspaceSchema } from './schema/workspace.schema'

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
  const stepper = useStepsContext()

  const workspace = useSessionStorageValue('getting-started.workspace')

  const utils = api.useUtils()

  const { mutateAsync } = api.workspaces.create.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  })

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

  const form = useAppForm({
    validators: {
      onBlur: workspaceSchema,
      onSubmit: workspaceSchema,
    },
    defaultValues: {
      name: '',
      slug: '',
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await mutateAsync({ name: value.name, slug: value.slug })
        if (result?.slug) {
          workspace.set(result.slug)
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
    form.setFieldValue('slug', slugValue)

    if (!workspaceSchema.shape.slug.safeParse(slugValue).success) {
      slugAvailable.reset()
      return
    }

    checkSlug({ slug: slugValue })
  }

  const slugValidationState: SlugValidationState = {
    isValidSlug: workspaceSchema.shape.slug.safeParse(
      form.getFieldValue('slug'),
    ).success,
    isPending: slugAvailable.isPending,
    isAvailable: slugAvailable.data?.available,
  }

  return (
    <Form form={form}>
      <OnboardingStep
        title="Create a new workspace"
        description="Workspaces are shared spaces where teams can manage their data."
        submitLabel="Create workspace"
        maxW="lg"
      >
        <form.Layout>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label="Workspace name"
                autoFocus
                data-1p-ignore
                onChange={(e) => handleSlugChange(e.currentTarget.value)}
              />
            )}
          </form.AppField>
          <form.AppField name="slug">
            {(field) => (
              <field.TextField
                type="text"
                label="Workspace URL"
                ps={getBaseUrl().length * 7}
                startElement={
                  <Text color="fg.muted" pointerEvents="none" lineHeight="2">
                    {getBaseUrl()}/
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
