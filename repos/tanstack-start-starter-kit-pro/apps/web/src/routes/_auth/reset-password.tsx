import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { ResetPasswordPage } from '#features/auth/reset-password-page'

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: z.object({
    token: z.string(),
  }),
  head: () => ({
    meta: [
      {
        title: 'Reset Password',
      },
    ],
  }),
  component: ResetPasswordPage,
})
