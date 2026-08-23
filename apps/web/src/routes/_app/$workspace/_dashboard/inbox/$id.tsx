import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { InboxViewPage } from '#features/contacts/inbox/inbox-view-page'
import { InboxNotFound } from '#features/contacts/inbox/inbox.not-found'
import { productShell } from '#config/product-shell'

export const Route = createFileRoute('/_app/$workspace/_dashboard/inbox/$id')({
  validateSearch: z.object({
    contactId: z.string(),
  }),
  head: () => ({
    meta: [
      {
        title: productShell.labels.inbox,
      },
    ],
  }),
  notFoundComponent: NotFoundComponent,
  component: RouteComponent,
})

function NotFoundComponent() {
  const params = Route.useParams()
  return <InboxNotFound params={params} />
}

function RouteComponent() {
  const params = Route.useParams()
  return <InboxViewPage params={params} />
}
