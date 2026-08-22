import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AppLoader } from '@workspace/ui/app-loader'

import { client } from '#features/auth/auth-provider'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const { data } = await client.getSession()

    if (!data?.session) {
      throw redirect({
        to: '/login',
      })
    }

    return {
      session: data.session,
      user: data.user,
    }
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
  // pendingComponent: AppLoader,
  component: () => {
    return <Outlet />
  },
})
