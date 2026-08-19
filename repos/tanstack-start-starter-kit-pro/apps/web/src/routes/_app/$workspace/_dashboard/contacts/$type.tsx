import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import {
  ZContactTypeEnum,
  getContactType,
} from '#features/contacts/list/get-contact-type'
import { ContactsListPage } from '#features/contacts/list/list-page'

export const Route = createFileRoute(
  '/_app/$workspace/_dashboard/contacts/$type',
)({
  params: z.object({
    type: ZContactTypeEnum,
  }),
  head: ({ params }) => {
    const type = getContactType(params.type)

    return {
      meta: [
        {
          title: type?.label ?? 'Contacts',
        },
      ],
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()

  return <ContactsListPage params={params} />
}
