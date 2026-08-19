import * as z from 'zod'
import { Box, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { useSessionStorageValue } from '@react-hookz/web'
import { useMutation } from '@tanstack/react-query'

import * as Steps from '#ui/steps/steps'
import { subscribeToNewsletter } from '#api'
import { LinkButton } from '#components/button'
import { Form, useAppForm } from '#components/forms'

import { OnboardingStep } from './onboarding-step'

const schema = z.object({
  newsletter: z.boolean(),
})

interface SocialLink {
  title: string
  description: string
  href: string
  label: string
}

const socialLinks: SocialLink[] = [
  {
    title: 'Follow us on X',
    description: 'Regular posts with updates and tips.',
    href: 'https://x.com/saas_js',
    label: '@saas_js',
  },
  {
    title: 'Join our Discord community',
    description: 'Chat with other developers and founders.',
    href: 'https://saas-ui.dev/discord',
    label: 'Join Discord',
  },
]

export const SubscribeStep = () => {
  const stepper = Steps.useContext()

  const workspace = useSessionStorageValue<string>('getting-started.workspace')

  const { mutateAsync, isPending } = useMutation({
    mutationFn: subscribeToNewsletter,
  })

  const form = useAppForm({
    validators: { onSubmit: schema },
    defaultValues: { newsletter: false },
    onSubmit: async ({ value }) => {
      await mutateAsync({
        workspace: workspace.value!,
        newsletter: value.newsletter,
      })

      stepper.goToNextStep()
    },
  })

  return (
    <Form form={form}>
      <OnboardingStep
        title="Subscribe to updates"
        description="Saas UI is updated regularly. These are the best ways to stay up to date."
        maxW="lg"
        submitLabel="Continue"
      >
        <Box m="-6">
          <Flex
            borderBottomWidth="1px"
            p="6"
            display="flex"
            alignItems="center"
          >
            <Stack flex="1" alignItems="flex-start" gap="0.5">
              <Heading as="h4" size="sm">
                Subscribe to our monthly newsletter
              </Heading>
              <Text id="newsletter-description" color="fg.muted" textStyle="xs">
                Receive monthly updates in your email inbox.
              </Text>
            </Stack>
            <form.AppField name="newsletter">
              {(field) => (
                <field.SwitchField
                  aria-labelledby="newsletter-description"
                  disabled={isPending}
                />
              )}
            </form.AppField>
          </Flex>

          {socialLinks.map(({ title, description, href, label }) => (
            <Flex
              key={href}
              borderBottomWidth="1px"
              p="6"
              display="flex"
              alignItems="center"
              _last={{ borderBottomWidth: 0 }}
            >
              <Stack flex="1" alignItems="flex-start" gap="0.5">
                <Heading as="h4" size="sm">
                  {title}
                </Heading>
                <Text color="fg.muted" textStyle="xs">
                  {description}
                </Text>
              </Stack>
              <LinkButton href={href} target="_blank" disabled={isPending}>
                {label}
              </LinkButton>
            </Flex>
          ))}
        </Box>
      </OnboardingStep>
    </Form>
  )
}
