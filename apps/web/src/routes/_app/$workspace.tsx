import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'

import { BillingProvider } from '#features/billing/providers/billing-provider'
import { WorkspaceNotFound } from '#features/workspaces/workspace.not-found'

function isValidSlug(slug?: string) {
  return slug?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
}

export const Route = createFileRoute('/_app/$workspace')({
  beforeLoad: async ({ params, context }) => {
    if (!isValidSlug(params?.workspace)) {
      throw notFound()
    }

    const workspace = await context.trpc.workspaces.bySlug.ensureData({
      slug: params?.workspace,
    })

    if (!workspace) {
      throw notFound()
    }

    return { workspace }
  },
  notFoundComponent: WorkspaceNotFound,
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <BillingProvider>
      <Outlet />
    </BillingProvider>
  )
}
