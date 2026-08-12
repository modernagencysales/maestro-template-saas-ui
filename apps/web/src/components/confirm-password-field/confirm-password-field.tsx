import type * as React from "react";

import type { TextFieldProps } from "../form";

/**
 * Minimal structural shape of the app form used by `ConfirmPasswordField`.
 * `AppField` is typed permissively because its precise `name`/render types are
 * form-specific and contravariant, so they can't be captured structurally.
 */
export interface ConfirmPasswordForm {
  getFieldValue: (name: string) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AppField: React.ComponentType<any>;
}

export interface ConfirmPasswordProps<
  TForm extends ConfirmPasswordForm,
> extends Omit<TextFieldProps, "name" | "type"> {
  /** The form instance (from `useAppForm`). */
  form: TForm;
  /** Name of this confirm field. Defaults to `confirmPassword`. */
  name?: string;
  /** Name of the sibling password field to match. Defaults to `password`. */
  confirmField?: string;
  /** Error message shown when the values don't match. */
  message?: string;
}

/**
 * Password confirmation field. Validates equality against a sibling password
 * field and re-validates when that sibling changes (`onChangeListenTo`).
 *
 * Prefer encoding the match in the form's Zod schema (`.superRefine`) when the
 * schema is under your control; use this component for ad-hoc forms without a
 * schema-level match rule.
 */
export function ConfirmPasswordField<TForm extends ConfirmPasswordForm>(
  props: ConfirmPasswordProps<TForm>,
) {
  const {
    form,
    name = "confirmPassword",
    confirmField = "password",
    label = "Confirm password",
    message = "Passwords do not match",
    ...fieldProps
  } = props;

  return (
    <form.AppField
      name={name}
      validators={{
        onChangeListenTo: [confirmField],
        onChange: ({ value }: { value: string }) =>
          value !== form.getFieldValue(confirmField) ? message : undefined,
      }}
    >
      {(field: { TextField: React.ComponentType<TextFieldProps> }) => (
        <field.TextField type="password" label={label} {...fieldProps} />
      )}
    </form.AppField>
  );
}
