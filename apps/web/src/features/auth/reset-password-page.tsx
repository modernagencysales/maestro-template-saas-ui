"use client";

import { useAuth } from "@saas-ui/auth-provider";
import { Container, Stack, toast } from "@saas-ui/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { Form, useAppForm } from "@workspace/ui/form";

import { Link } from "#components/link";

import { AuthCard } from "./components/auth-card";
import {
  ResetPasswordFormInput,
  resetPasswordSchema,
} from "./schema/reset-password.schema";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();

  const auth = useAuth();
  const search = useSearch({
    from: "/_auth/reset-password",
  });

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormInput) => {
      return auth.updatePassword({
        password: values.newPassword,
        token: search.token,
      });
    },
    onSuccess: () => {
      toast.success({
        title: "Password updated",
        description: "You can now log in with your new password",
      });

      navigate({
        to: "/login",
      });
    },
    onError: (error) => {
      toast.error({
        title: "Could not update your password",
        description:
          error.message ??
          "Please try again or contact us if the problem persists.",
      });
    },
  });

  const form = useAppForm({
    validators: {
      onBlur: resetPasswordSchema,
      onSubmit: resetPasswordSchema,
    },
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }: { value: ResetPasswordFormInput }) => {
      await mutation.mutateAsync(value);
    },
  });

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
        <Container maxW="sm" py="8">
          <AuthCard
            title="Choose a new password"
            footer={<Link to="/login">Back to log in</Link>}
          >
            <Form form={form}>
              <form.AppField name="newPassword">
                {(field) => (
                  <field.TextField type="password" label="Password" />
                )}
              </form.AppField>

              <form.AppField name="confirmPassword">
                {(field) => (
                  <field.TextField type="password" label="Confirm Password" />
                )}
              </form.AppField>

              <form.SubmitButton>Reset password</form.SubmitButton>
            </Form>
          </AuthCard>
        </Container>
      </Stack>
    </Stack>
  );
};
