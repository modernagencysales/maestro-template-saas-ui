import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { AppLoader } from '@workspace/ui/app-loader'

import { AuthLayout } from '#features/auth/auth-layout'
import { client } from '#features/auth/auth-provider'

export const Route = createFileRoute('/_auth')({
  validateSearch: z.object({
    redirectTo: z.string().optional(),
  }),
  beforeLoad: async () => {
    const { data } = await client.getSession()

    if (data?.session) {
      throw redirect({
        to: '/',
      })
    }
  },
  pendingComponent: AppLoader,
  component: () => (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  ),
})
