import { createFileRoute } from '@tanstack/react-router'

import { ContactsListPage } from '#features/contacts/list/list-page'

export const Route = createFileRoute('/_app/$workspace/_dashboard/tag/$tag')({
  head: () => ({
    meta: [
      {
        title: 'Contacts by tag',
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return <ContactsListPage params={params} />
}
