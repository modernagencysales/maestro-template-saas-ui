import { createFileRoute } from '@tanstack/react-router'

import { ContactsListPage } from '#features/contacts/list/list-page'

export const Route = createFileRoute('/_app/$workspace/_dashboard/contacts/')({
  head: () => ({
    meta: [
      {
        title: 'Contacts',
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return <ContactsListPage params={params} />
}
