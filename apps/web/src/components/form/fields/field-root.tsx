import * as React from "react";

import { Field } from "@saas-ui/react";

import type { BaseFieldProps } from "./types";

export interface FieldRootProps extends BaseFieldProps {
  fieldId?: string;
  invalid: boolean;
  errorText?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for every field component: renders the Chakra `Field.Root`
 * with label, the control (`children`), and helper/error text.
 */
export function FieldRoot(props: FieldRootProps) {
  const {
    label,
    fieldId,
    help,
    orientation,
    required,
    rootProps,
    invalid,
    errorText,
    children,
  } = props;

  return (
    <Field.Root
      orientation={orientation}
      required={required}
      invalid={invalid}
      {...rootProps}
    >
      {label && <Field.Label htmlFor={fieldId}>{label}</Field.Label>}
      {children}
      {help && !invalid && <Field.HelperText>{help}</Field.HelperText>}
      {invalid && errorText && <Field.ErrorText>{errorText}</Field.ErrorText>}
    </Field.Root>
  );
}
