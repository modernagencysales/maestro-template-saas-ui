import { createFileRoute, redirect } from '@tanstack/react-router'

import { DefaultLoader } from '#components/default-loader'
import { getLastUsedWorkspace } from '#lib/last-used-workspace'

export const Route = createFileRoute('/_app/')({
  beforeLoad: async ({ context }) => {
    if (!context.session) {
      throw redirect({
        to: '/login',
      })
    }

    const user = await context.trpc.auth.me.ensureData().catch(() => {
      return null
    })

    if (!user) {
      throw redirect({
        to: '/login',
      })
    }

    const lastUsedWorkspace = getLastUsedWorkspace()

    const workspace = lastUsedWorkspace
      ? (user.workspaces.find(({ slug }) => slug === lastUsedWorkspace) ??
        user.workspaces[0])
      : user.workspaces[0]

    if (!workspace) {
      throw redirect({
        to: '/getting-started',
      })
    }

    throw redirect({
      to: '/$workspace',
      params: {
        workspace: workspace.slug,
      },
    })
  },
  pendingComponent: DefaultLoader,
  component: () => null,
})
