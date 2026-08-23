import { Outlet, createFileRoute } from '@tanstack/react-router'

import { InboxLayout } from '#features/contacts/inbox/inbox-layout'
import { productShell } from '#config/product-shell'

export const Route = createFileRoute('/_app/$workspace/_dashboard/inbox')({
  head: () => ({
    meta: [
      {
        title: productShell.labels.inbox,
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <InboxLayout params={params}>
      <Outlet />
    </InboxLayout>
  )
}
