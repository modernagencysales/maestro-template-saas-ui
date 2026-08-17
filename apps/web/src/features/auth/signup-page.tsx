'use client'

import { Center, Container, Stack, Text } from '@chakra-ui/react'
import { useAuth } from '@saas-ui/auth-provider'
import { toast } from '@saas-ui/react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'

import { Form, useAppForm } from '@workspace/ui/form'

import { Link } from '#components/link'

import { AuthCard } from './components/auth-card'
import { Testimonial } from './components/testimonial'
import { type SignupFormInput, signupSchema } from './schema/signup.schema'

export const SignupPage = () => {
  const navigate = useNavigate()
  const search = useSearch({
    from: '/_auth/signup',
  })
  const auth = useAuth()

  const { mutateAsync, isPending, isSuccess } = useMutation({
    mutationFn: (params: SignupFormInput) => auth.signUp(params),
    onSuccess: () => {
      navigate({
        to: search.redirectTo ?? '/',
      })
    },
    onError: (error) => {
      toast.error({
        title: error.message ?? 'Could not sign you up',
        description: 'Please try again or contact us if the problem persists.',
      })
    },
  })

  const form = useAppForm({
    validators: {
      onBlur: signupSchema,
      onSubmit: signupSchema,
    },
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }: { value: SignupFormInput }) => {
      await mutateAsync({
        email: value.email,
        password: value.password,
      })
    },
  })

  return (
    <Stack flex="1" direction="row" height="100dvh" bg="bg.muted">
      <Stack
        flex="1"
        alignItems="center"
        justify="center"
        direction="column"
        gap="8"
        textStyle="sm"
      >
        <Container maxW="md" py="8">
          <AuthCard
            title="Sign up"
            footer={
              <Text color="fg.muted">
                Already have an account? <Link to="/login">Log in</Link>.
              </Text>
            }
          >
            <Form form={form}>
              <form.Layout>
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      label="Email"
                      autoComplete="email"
                      type="email"
                    />
                  )}
                </form.AppField>

                <form.AppField name="password">
                  {(field) => (
                    <field.TextField
                      label="Password"
                      type="password"
                      autoComplete="password"
                    />
                  )}
                </form.AppField>

                <Link to="/forgot-password" mt="-2">
                  Forgot your password?
                </Link>

                <form.SubmitButton
                  loadingText="Creating account..."
                  disabled={isPending || isSuccess}
                >
                  Sign up
                </form.SubmitButton>
              </form.Layout>
            </Form>
          </AuthCard>

          <Text textAlign="center" color="fg.muted" mt="4">
            By signing up, you agree to our{' '}
              <a href="/terms">Terms of Service</a> and{' '}
              <a href="/privacy">Privacy Policy</a>.
          </Text>
        </Container>
      </Stack>
      <Stack flex="1" bg="accent.solid">
        <Center flex="1">
          <Testimonial />
        </Center>
      </Stack>
    </Stack>
  )
}
