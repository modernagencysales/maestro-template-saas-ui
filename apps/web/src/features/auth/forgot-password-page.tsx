'use client'

import { Alert, Container, Stack } from '@chakra-ui/react'
import { useAuth } from '@saas-ui/auth-provider'
import { toast } from '@saas-ui/react'
import { useMutation } from '@tanstack/react-query'

import { Form, useAppForm } from '@workspace/ui/form'

import { Link } from '#components/link'

import { AuthCard } from './components/auth-card'
import {
  ForgotPasswordFormInput,
  forgotPasswordSchema,
} from './schema/forgot-password.schema.ts'

export const ForgotPasswordPage = () => {
  const auth = useAuth()

  const mutation = useMutation({
    mutationFn: (params: ForgotPasswordFormInput) =>
      auth.resetPassword(params, {
        redirectTo: '/reset-password',
      }),
    onError: (error) => {
      toast.error({
        title: 'Reset password failed',
        description: error.message,
      })
    },
  })

  const form = useAppForm({
    validators: {
      onBlur: forgotPasswordSchema,
      onSubmit: forgotPasswordSchema,
    },
    defaultValues: {
      email: '',
    },
    onSubmit: async ({ value }: { value: ForgotPasswordFormInput }) => {
      await mutation.mutateAsync(value)
    },
  })

  return (
    <Stack flex="1" direction="row" minH="100vh" bg="bg.muted">
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
            title="Forgot your password?"
            footer={<Link to="/login">Back to log in</Link>}
          >
            {mutation.data ? (
              <Alert.Root
                status="success"
                flexDirection="column"
                alignItems="flex-start"
              >
                <Alert.Title>Password reset email sent</Alert.Title>
                <Alert.Description>
                  We&apos;ve sent an email to {mutation.variables?.email} with a
                  link to reset your password.
                </Alert.Description>
              </Alert.Root>
            ) : (
              <Form form={form}>
                <form.Layout>
                  <form.AppField name="email">
                    {(field) => (
                      <field.TextField
                        label="Email"
                        type="email"
                        help="Enter your email address and we will send you a link to reset your password."
                      />
                    )}
                  </form.AppField>
                  <form.SubmitButton>Reset password</form.SubmitButton>
                </form.Layout>
              </Form>
            )}
          </AuthCard>
        </Container>
      </Stack>
    </Stack>
  )
}
