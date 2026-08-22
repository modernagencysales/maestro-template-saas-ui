import { createFileRoute } from '@tanstack/react-router'

import { SignupPage } from '#features/auth/signup-page'

export const Route = createFileRoute('/_auth/signup')({
  head: () => ({
    meta: [
      {
        title: 'Signup',
      },
    ],
  }),
  component: SignupPage,
})
