import {
  Box,
  Flex,
  Heading,
  Stack,
  Text,
  useStepsContext,
} from '@chakra-ui/react'
import { Switch, toast } from '@saas-ui/react'

import { LinkButton } from '@workspace/ui/button'
import { Form, useAppForm } from '@workspace/ui/form'

import { api } from '#lib/trpc/react'

import { OnboardingStep } from './onboarding-step'
import { subscribeSchema } from './schema/subscribe.schema'

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
  const stepper = useStepsContext()

  const { mutateAsync, isPending } =
    api.users.subscribeToNewsletter.useMutation({
      onError: () => {
        toast.error({
          title: 'Could not subscribe you to our newsletter.',
        })
      },
    })

  const form = useAppForm({
    validators: {
      onSubmit: subscribeSchema,
    },
    defaultValues: { newsletter: false },
    onSubmit: async ({ value }) => {
      await mutateAsync({
        newsletter: value.newsletter,
      })

      stepper.goToNextStep()
    },
  })

  return (
    <Form form={form}>
      <OnboardingStep
        title="Subscribe to updates"
        description="Saas.js is updated regularly. These are the best ways to stay up to date."
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
                <Switch
                  name="newsletter"
                  checked={field.state.value}
                  onCheckedChange={({ checked }) => field.handleChange(checked)}
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
