import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { SearchPage } from '#features/search/search-page'

export const Route = createFileRoute('/_app/$workspace/_dashboard/search')({
  validateSearch: z.object({
    q: z.string().optional().default(''),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return <SearchPage />
}
