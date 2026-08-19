'use client'

import {
  Box,
  Card,
  Center,
  Container,
  HStack,
  Heading,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useAuth } from '@saas-ui/auth-provider'
import { z } from 'zod'

import * as LoadingOverlay from '#ui/loading-overlay/loading-overlay'
import { Form, useAppForm } from '#components/forms'
import { Link } from '#components/link'
import { LogoIcon } from '#components/logo'

const schema = z.object({
  email: z.email(),
  password: z.string().min(4),
})

export const SignupPage = () => {
  const { isAuthenticated, signUp } = useAuth()

  const form = useAppForm({
    defaultValues: {
      email: 'demo@saas-ui.dev',
      password: 'demo',
    },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => {
      void signUp(value)
    },
  })

  if (isAuthenticated) {
    return (
      <LoadingOverlay.Root variant="fullscreen">
        <LoadingOverlay.Spinner />
      </LoadingOverlay.Root>
    )
  }

  return (
    <Stack flex="1" direction="row" minH="100vh" bg="bg.muted">
      <Stack
        flex="1"
        alignItems="center"
        justify="center"
        direction="column"
        gap="8"
      >
        <Container maxWidth="sm">
          <Card.Root overflow="clip" layerStyle="overlay" border="0">
            <Card.Body p="6">
              <LogoIcon
                boxSize="10"
                color="accent.solid"
                margin="0 auto"
                mb="8"
              />
              <Heading as="h1" size="2xl" textAlign="center" mb="6">
                Create an account
              </Heading>

              <Form form={form}>
                <form.Layout>
                  <form.AppField name="email">
                    {(field) => <field.TextField label="Email" type="email" />}
                  </form.AppField>
                  <form.AppField name="password">
                    {(field) => (
                      <field.TextField label="Password" type="password" />
                    )}
                  </form.AppField>
                  <form.SubmitButton>Sign up</form.SubmitButton>
                </form.Layout>
              </Form>
            </Card.Body>
            <Card.Footer
              bg="bg.muted"
              borderTopWidth="1px"
              justifyContent="center"
              py="3"
            >
              <Text color="fg.muted" textStyle="sm">
                Already have an account?{' '}
                <Link href="/login" color="fg">
                  Log in
                </Link>
                .
              </Text>
            </Card.Footer>
          </Card.Root>
        </Container>
      </Stack>
      <Stack flex="1" bg="colorPalette.solid">
        <Center flex="1">
          <Container maxWidth="md">
            <HStack mb="4" gap="4">
              <Box>
                <Text color="fg.inverted" fontSize="md" fontWeight="medium">
                  Ahmed
                </Text>
                <Text color="fg.inverted/80" fontSize="md">
                  Founder of{' '}
                  <Link href="https://localxpose.io" color="fg.inverted">
                    LocalXpose
                  </Link>
                </Text>
              </Box>
            </HStack>
            <Text color="white" fontSize="md">
              I really recommend Saas UI to any developer or team seeking a
              robust, visually appealing, and easy-to-implement UI framework.
              The support and updates from the Saas UI team were exceptional,
              Thank you.
            </Text>
          </Container>
        </Center>
      </Stack>
    </Stack>
  )
}
