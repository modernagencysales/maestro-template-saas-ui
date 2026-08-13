import * as z from 'zod'

import { passwordSchema } from './password.schema'

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema.shape.password.describe('New password'),
    confirmPassword: passwordSchema.shape.password.describe('Confirm password'),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      })
    }
  })

export type ResetPasswordFormInput = z.infer<typeof resetPasswordSchema>
