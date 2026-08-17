import { createFileRoute } from '@tanstack/react-router'

import { LoginPage } from '#features/auth/login-page'

export const Route = createFileRoute('/_auth/login')({
  head: () => ({
    meta: [{ title: 'Login' }],
  }),
  component: LoginPage,
})
