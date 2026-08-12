"use client";

import { useCallback } from "react";

import { Container, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import { useLocalStorageValue } from "@react-hookz/web";
import { useAuth } from "@saas-ui/auth-provider";
import { toast } from "@saas-ui/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { Form, useAppForm } from "@workspace/ui/form";

import { Link } from "#components/link";

import { AuthCard } from "./components/auth-card";
import { LastUsedProvider } from "./components/last-used";
import { Providers } from "./components/providers";
import { LoginFormInput, loginSchema } from "./schema/login.schema";

export const LoginPage = () => {
  const navigate = useNavigate();

  const search = useSearch({
    from: "/_auth/login",
  });

  const auth = useAuth();

  const lastUsed = useLocalStorageValue("lastUsedProvider", {
    initializeWithValue: false,
  });

  const mutation = useMutation({
    mutationFn: (params: LoginFormInput) => auth.logIn(params),
    onSuccess: () => {
      lastUsed.set("credentials");

      navigate({
        to: search.redirectTo ?? "/",
      });
    },
    onError: (error) => {
      toast.error({
        title: error.message ?? "Could not log you in",
        description: "Please try again or contact us if the problem persists.",
      });
    },
  });

  const emailRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (lastUsed.value === "credentials") {
        el?.focus();
      }
    },
    [lastUsed.value],
  );

  const form = useAppForm({
    validators: {
      onBlur: loginSchema,
      onSubmit: loginSchema,
    },
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }: { value: LoginFormInput }) => {
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
        <Container maxW="md" py="8">
          <AuthCard
            title="Log in"
            footer={
              <Text color="fg.muted">
                Don&apos;t have an account yet?{" "}
                <Link to="/signup">Sign up</Link>.
              </Text>
            }
          >
            <Providers />

            <HStack my="4">
              <Separator />
              <Text flexShrink={0} color="fg.muted">
                Or continue with
              </Text>
              <Separator />
            </HStack>

            <Form form={form}>
              <form.Layout>
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      label="Email"
                      type="email"
                      autoComplete="email"
                      ref={emailRef}
                      endElement={
                        <LastUsedProvider value="credentials">
                          <div />
                        </LastUsedProvider>
                      }
                    />
                  )}
                </form.AppField>

                <form.AppField name="password">
                  {(field) => (
                    <field.TextField
                      type="password"
                      label="Password"
                      autoComplete="password"
                    />
                  )}
                </form.AppField>

                <Link to="/forgot-password">Forgot your password?</Link>

                <form.SubmitButton>Log in</form.SubmitButton>
              </form.Layout>
            </Form>
          </AuthCard>
        </Container>
      </Stack>
    </Stack>
  );
};
