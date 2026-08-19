import { createFileRoute } from '@tanstack/react-router'

import { ContactPage } from '#features/contacts/view/contact-page'
import { ContactError } from '#features/contacts/view/contact.error'
import { ContactNotFound } from '#features/contacts/view/contact.not-found'

export const Route = createFileRoute(
  '/_app/$workspace/_dashboard/contacts/view/$id',
)({
  notFoundComponent: NotFoundComponent,
  errorComponent: ContactError,
  component: RouteComponent,
})

function NotFoundComponent() {
  const params = Route.useParams()
  return <ContactNotFound params={params} />
}

function RouteComponent() {
  const params = Route.useParams()
  return <ContactPage params={params} />
}
