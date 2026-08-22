import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { InboxViewPage } from '#features/contacts/inbox/inbox-view-page'
import { InboxNotFound } from '#features/contacts/inbox/inbox.not-found'

export const Route = createFileRoute('/_app/$workspace/_dashboard/inbox/$id')({
  validateSearch: z.object({
    contactId: z.string(),
  }),
  loaderDeps: ({ search }) => ({
    contactId: search.contactId,
  }),
  loader: async ({ context, deps }) => {
    const contact = await context.trpc.contacts.byId.ensureData({
      workspaceId: context.workspace.id,
      id: deps.contactId,
    })

    return { contact }
  },
  head: (ctx) => ({
    meta: [
      {
        title: ctx.loaderData?.contact?.name ?? '',
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
