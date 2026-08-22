'use client'

import { Card, Container, Heading, Stack, Text } from '@chakra-ui/react'
import { useAuth } from '@saas-ui/auth-provider'
import { z } from 'zod'

import * as LoadingOverlay from '#ui/loading-overlay/loading-overlay'
import { Form, useAppForm } from '#components/forms'
import { Link } from '#components/link'
import { LogoIcon } from '#components/logo'

const schema = z.object({
  email: z.email().default('demo@saas-ui.dev'),
  password: z.string().min(4).default('demo'),
})

export const LoginPage = () => {
  const { isAuthenticated, logIn } = useAuth()

  const form = useAppForm({
    defaultValues: {
      email: 'demo@saas-ui.dev',
      password: 'demo',
    },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => {
      void logIn(value)
    },
  })

  if (isAuthenticated) {
    return (
      <LoadingOverlay.Root>
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
                Welcome back
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
                  <form.SubmitButton>Log in</form.SubmitButton>
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
                Don&apos;t have an account yet?{' '}
                <Link href="/signup" color="fg">
                  Sign up
                </Link>
                .
              </Text>
            </Card.Footer>
          </Card.Root>
        </Container>
      </Stack>
    </Stack>
  )
}
