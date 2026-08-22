import * as React from 'react'

type FormDialogProps<T> = any

interface SubmitParams {
  password: string
  newPassword: string
  confirmPassword: string
}

export interface UpdatePasswordFormProps
  extends Omit<
    FormDialogProps<SubmitParams>,
    'onSubmit' | 'title' | 'scrollBehavior' | 'children'
  > {
  title?: string
  label?: string
  confirmLabel?: string
  helpText?: string
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
  onValidationError?: (error: any) => void
  newLabel?: string
  submitLabel?: string
}

export const UpdatePasswordDialog: React.FC<UpdatePasswordFormProps> = ({
  onSuccess = () => null,
  onError = () => null,
  onValidationError,
  title = 'Update your password',
  submitLabel = 'Update your password',
  label = 'Current password',
  newLabel = 'New password',
  confirmLabel = 'Confirm password',
  helpText,
  ...formProps
}) => {
  return null
  // return (
  // <FormDialog
  //   title={title}
  //   fields={{
  //     submit: {
  //       children: submitLabel,
  //     },
  //   }}
  //   onError={onValidationError}
  //   onSubmit={({ newPassword }) => {
  //     return submit({ password: newPassword }).then(onSuccess).catch(onError)
  //   }}
  //   defaultValues={{ password: '', newPassword: '', confirmPassword: '' }}
  //   {...formProps}
  // >
  //   <FormLayout>
  //     <Field
  //       name="password"
  //       label={label}
  //       type="password"
  //       rules={{ required: true }}
  //       help={helpText}
  //     />

  //     <Field
  //       name="newPassword"
  //       label={newLabel}
  //       type="password"
  //       rules={{ required: true }}
  //     />

  //     <ConfirmPasswordField label={confirmLabel} confirmField="newPassword" />
  //   </FormLayout>
  // </FormDialog>
  // )
}
