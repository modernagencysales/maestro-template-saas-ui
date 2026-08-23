import { createFileRoute } from '@tanstack/react-router'

import { ContactsListPage } from '#features/contacts/list/list-page'
import { productShell } from '#config/product-shell'

export const Route = createFileRoute('/_app/$workspace/_dashboard/contacts/')({
  head: () => ({
    meta: [
      {
        title: productShell.labels.contacts,
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return <ContactsListPage params={params} />
}
