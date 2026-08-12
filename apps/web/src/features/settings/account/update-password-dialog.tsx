import * as React from "react";

import { useUpdatePassword } from "@saas-ui/auth-provider";
import { Button, Dialog } from "@saas-ui/react";

import { Form, useAppForm } from "@workspace/ui/form";

import { updatePasswordSchema } from "./schema/update-password.schema.ts";

export interface UpdatePasswordFormProps extends Omit<
  Dialog.RootProps,
  "children"
> {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onValidationError?: (error: any) => void;
}

export const UpdatePasswordDialog: React.FC<UpdatePasswordFormProps> = ({
  onSuccess = () => null,
  onError = () => null,
  onValidationError = () => null,
  open,
  onOpenChange,
}) => {
  const [, submit] = useUpdatePassword();

  const form = useAppForm({
    validators: {
      onBlur: updatePasswordSchema,
      onSubmit: updatePasswordSchema,
    },
    defaultValues: {
      password: "",
      newPassword: "",
      confirmPassword: "",
    },
    onSubmitInvalid: onValidationError,
    onSubmit: async ({ value }) => {
      try {
        const data = await submit({
          password: value.password,
          newPassword: value.newPassword,
        });
        onSuccess(data);
      } catch (error) {
        onError(error);
      }
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Form form={form}>
          <Dialog.Header>
            <Dialog.Title>Update your password</Dialog.Title>

            <Dialog.CloseButton />
          </Dialog.Header>
          <Dialog.Body>
            <form.Layout>
              <form.AppField name="password">
                {(field) => (
                  <field.TextField
                    label="Current Password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your current password"
                  />
                )}
              </form.AppField>

              <form.AppField name="newPassword">
                {(field) => (
                  <field.TextField
                    label="New Password"
                    type="password"
                    placeholder="Enter a new password"
                  />
                )}
              </form.AppField>

              <form.AppField name="confirmPassword">
                {(field) => (
                  <field.TextField
                    label="Confirm Password"
                    type="password"
                    placeholder="Confirm your new password"
                  />
                )}
              </form.AppField>
            </form.Layout>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.CloseTrigger>
            <form.SubmitButton>Update password</form.SubmitButton>
          </Dialog.Footer>
        </Form>
      </Dialog.Content>
    </Dialog.Root>
  );
};
